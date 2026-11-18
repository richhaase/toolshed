import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { BoardError } from "./errors";
import { attentionGroupCounts, classifyPullRequest } from "./pr-attention";
import { collectOrganizationPullRequests } from "./sources/organization";
import type { OrganizationPullRequestCollection, PullRequestQueueEvidence, PullRequestQueueFilter, PullRequestQueueProgress, PullRequestQueueQuery, PullRequestQueueSnapshot, QueueCollectedPullRequest } from "./pr-queue-types";
import type { PullRequestRecord } from "./shared";

const DAY = 86_400_000;
const ORGANIZATION = /^[a-z0-9](?:[a-z0-9-]{0,38})$/i;
const REPOSITORY = /^[a-z0-9-]+\/[a-z0-9_.-]+$/i;
interface SavedQuery { revision: number; query: PullRequestQueueQuery }
interface SavedCollection { id: string; epoch: number; collection: OrganizationPullRequestCollection }
interface Dependencies {
  now: () => Date;
  collect: typeof collectOrganizationPullRequests;
  onAccessChange?: (account: { id: string; login: string } | null) => void;
  onAccessDenied?: (organization: string, repositories: string[] | null) => void;
}

function cleanQuery(query: PullRequestQueueQuery): PullRequestQueueQuery {
  if (query.organization !== null && (typeof query.organization !== "string" || !ORGANIZATION.test(query.organization))) throw new BoardError("invalid_organization", "Use a GitHub organization login.");
  const organization = query.organization?.toLowerCase() ?? null;
  if (typeof query.repository !== "string" || (query.repository !== "all" && (!REPOSITORY.test(query.repository) || query.repository.split("/")[0].toLowerCase() !== organization))) throw new BoardError("invalid_repository", "Choose all repositories or a repository within this organization.");
  if (!["all", "mine", "review"].includes(query.attention) || ![7, 14, 30].includes(query.days)) throw new BoardError("invalid_query", "Choose an attention filter and a merged-history window of 7, 14, or 30 days.");
  return { ...query, organization };
}

export class PullRequestQueueStore {
  private verified = new Map<string, { id: string; epoch: number }>();
  private inFlight = new Map<string, Promise<void>>();
  constructor(private db: DatabaseSync, private dependencies: Dependencies) {
    db.exec("CREATE TABLE IF NOT EXISTS pr_queries (board_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, state TEXT NOT NULL); CREATE TABLE IF NOT EXISTS pr_collections (organization TEXT PRIMARY KEY, id TEXT NOT NULL, epoch INTEGER NOT NULL, state TEXT NOT NULL); CREATE TABLE IF NOT EXISTS pr_refreshes (organization TEXT PRIMARY KEY, run_id TEXT NOT NULL, epoch INTEGER NOT NULL, state TEXT NOT NULL); CREATE TABLE IF NOT EXISTS pr_access (id INTEGER PRIMARY KEY CHECK(id=1), epoch INTEGER NOT NULL, account TEXT)");
    db.prepare("INSERT OR IGNORE INTO pr_access(id,epoch,account) VALUES(1,0,NULL)").run();
  }
  private access(): { epoch: number; account: { id: string; login: string } | null } {
    const row = this.db.prepare("SELECT epoch,account FROM pr_access WHERE id=1").get()!;
    return { epoch: Number(row.epoch), account: row.account === null ? null : JSON.parse(String(row.account)) };
  }
  accessEpoch(): number { return this.access().epoch; }
  invalidateEvidenceInTransaction(expectedEpoch: number): number {
    if (this.access().epoch !== expectedEpoch) throw new BoardError("refresh_superseded", "GitHub access changed while refreshing.");
    this.db.prepare("UPDATE pr_access SET epoch=epoch+1 WHERE id=1").run();
    this.db.prepare("DELETE FROM pr_collections").run();
    this.db.prepare("DELETE FROM pr_refreshes").run();
    this.verified.clear();
    return this.access().epoch;
  }
  observeAccountInTransaction(account: { id: string; login: string } | null, expectedEpoch: number): number {
    const current = this.access();
    if (current.epoch !== expectedEpoch) throw new BoardError("refresh_superseded", "GitHub access changed while refreshing. Refresh again using the current account.");
    if ((account?.id ?? null) !== (current.account?.id ?? null)) {
      this.db.prepare("UPDATE pr_access SET epoch=epoch+1,account=? WHERE id=1").run(account ? JSON.stringify(account) : null);
      this.db.prepare("DELETE FROM pr_collections").run();
      this.db.prepare("DELETE FROM pr_refreshes").run();
      this.verified.clear();
    }
    return this.access().epoch;
  }
  private invalidate(): void {
    this.db.prepare("UPDATE pr_access SET epoch=epoch+1,account=NULL WHERE id=1").run();
    this.db.prepare("DELETE FROM pr_collections").run();
    this.verified.clear();
  }
  private saved(boardId: string, inferredOrganization: string | null): SavedQuery {
    const row = this.db.prepare("SELECT revision,state FROM pr_queries WHERE board_id=?").get(boardId);
    return row ? { revision: Number(row.revision), query: cleanQuery(JSON.parse(String(row.state))) } : { revision: 0, query: { organization: inferredOrganization?.toLowerCase() ?? null, repository: "all", attention: "all", days: 14 } };
  }
  ensure(boardId: string, inferredOrganization: string | null): void {
    const saved = this.saved(boardId, inferredOrganization);
    this.db.prepare("INSERT OR IGNORE INTO pr_queries(board_id,revision,state) VALUES(?,?,?)").run(boardId, saved.revision, JSON.stringify(saved.query));
  }
  private collection(organization: string | null): SavedCollection | null {
    if (!organization) return null;
    const row = this.db.prepare("SELECT id,epoch,state FROM pr_collections WHERE organization=?").get(organization);
    return row ? { id: String(row.id), epoch: Number(row.epoch), collection: JSON.parse(String(row.state)) } : null;
  }
  private progress(organization: string | null): PullRequestQueueProgress | null {
    if (!organization) return null;
    const row = this.db.prepare("SELECT state FROM pr_refreshes WHERE organization=? AND epoch=(SELECT epoch FROM pr_access WHERE id=1)").get(organization);
    if (!row) return null;
    const progress = JSON.parse(String(row.state)) as PullRequestQueueProgress;
    return progress.status === "running" && this.dependencies.now().getTime() - Date.parse(progress.startedAt) >= 180_000 ? { ...progress, status: "failed", phase: "finished", finishedAt: new Date(Date.parse(progress.startedAt) + 180_000).toISOString(), message: "PR refresh was interrupted. Refresh pull requests to try again." } : progress;
  }
  private records(query: PullRequestQueueQuery, collection: OrganizationPullRequestCollection | null): PullRequestRecord[] {
    if (!collection?.account) return [];
    const since = new Date(Date.parse(collection.collectedAt) - query.days * DAY).toISOString();
    return collection.pullRequests.filter(record => (query.repository === "all" || record.repository.toLowerCase() === query.repository.toLowerCase()) && (record.state === "open" || (record.mergedAt !== null && record.mergedAt >= since && record.mergedAt < collection.collectedAt)))
      .map(record => {
        const { workflow: _workflow, ...value } = record;
        return { ...value, attention: classifyPullRequest(record, collection.account!.login) };
      }).filter(record => query.attention === "all" || (query.attention === "review" ? ["awaiting_review", "awaiting_re_review"].includes(record.attention.group) : record.author.toLowerCase() === collection.account!.login.toLowerCase() || record.review?.assignees.some(login => login.toLowerCase() === collection.account!.login.toLowerCase()) || !["needs_review", "other_org"].includes(record.attention.group)));
  }
  read(boardId: string, inferredOrganization: string | null): PullRequestQueueSnapshot {
    const saved = this.saved(boardId, inferredOrganization);
    const stored = this.collection(saved.query.organization);
    const access = this.access();
    const checked = saved.query.organization ? this.verified.get(saved.query.organization) : undefined;
    const refresh = this.progress(saved.query.organization);
    const verified = stored !== null && stored.epoch === access.epoch && stored.id === checked?.id && checked.epoch === access.epoch && stored.collection.account?.id === access.account?.id && refresh?.status !== "running";
    const collection = verified ? stored!.collection : null;
    const records = this.records(saved.query, collection);
    const open = records.filter(record => record.state === "open");
    const note = !saved.query.organization ? "Choose a GitHub organization to collect pull requests. Local clones are not required." : !collection ? "Refresh pull requests to verify GitHub access for this organization in this session." : collection.error ?? (!collection.openComplete || !collection.mergedComplete || !collection.detailsComplete ? "Some organization PRs or review details are unavailable. Counts are lower bounds; unknown review states remain visible." : "Organization PR discovery and review details are complete for this collection.");
    return { boardId, revision: saved.revision, snapshotId: `pr:${boardId}:${saved.revision}:${saved.query.organization ?? "none"}:${stored?.id ?? "uncollected"}:${access.epoch}:${verified ? "verified" : "unverified"}`, query: saved.query, account: collection?.account ?? null, collectedAt: collection?.collectedAt ?? null, needsRefresh: !verified, repositories: collection ? [...new Set(collection.pullRequests.map(pr => pr.repository))].sort() : [], refresh, coverage: { openComplete: collection?.openComplete ?? false, mergedComplete: collection?.mergedComplete ?? false, detailsComplete: collection?.detailsComplete ?? false, note }, totals: { open: open.length, merged: records.filter(record => record.state === "merged").length, groups: attentionGroupCounts(open) } };
  }
  update(boardId: string, inferredOrganization: string | null, expectedRevision: number, patch: Partial<PullRequestQueueQuery>): PullRequestQueueSnapshot {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new BoardError("invalid_revision", "Use the revision returned by read_pull_request_queue.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const saved = this.saved(boardId, inferredOrganization);
      if (saved.revision !== expectedRevision) throw new BoardError("revision_conflict", "The PR query changed. Read the PR queue, then retry with its current revision.");
      const organizationChanged = patch.organization !== undefined && patch.organization?.toLowerCase() !== saved.query.organization;
      const query = cleanQuery({ ...saved.query, ...(organizationChanged ? { repository: "all" } : {}), ...patch });
      if (JSON.stringify(query) !== JSON.stringify(saved.query)) this.db.prepare("INSERT INTO pr_queries(board_id,revision,state) VALUES(?,?,?) ON CONFLICT(board_id) DO UPDATE SET revision=excluded.revision,state=excluded.state").run(boardId, saved.revision + 1, JSON.stringify(query));
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.read(boardId, inferredOrganization);
  }
  async refresh(boardId: string, inferredOrganization: string | null, signal?: AbortSignal, onProgress?: (progress: PullRequestQueueProgress) => void): Promise<PullRequestQueueSnapshot> {
    const query = this.saved(boardId, inferredOrganization).query;
    if (!query.organization) throw new BoardError("organization_required", "Choose a GitHub organization before refreshing pull requests.");
    const organization = query.organization;
    const existing = this.inFlight.get(organization);
    if (existing) { await existing; return this.read(boardId, inferredOrganization); }
    const operation = this.collect(organization, signal, onProgress);
    this.inFlight.set(organization, operation);
    try { await operation; }
    finally { this.inFlight.delete(organization); }
    return this.read(boardId, inferredOrganization);
  }
  private async collect(organization: string, signal?: AbortSignal, onProgress?: (progress: PullRequestQueueProgress) => void): Promise<void> {
    const until = this.dependencies.now().toISOString();
    const progress: PullRequestQueueProgress = { id: randomUUID(), status: "running", phase: "discovering", startedAt: until, updatedAt: until, finishedAt: null, completed: 0, total: null, requests: 0, message: "Discovering organization pull requests." };
    let access: ReturnType<PullRequestQueueStore["access"]>;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      access = this.access();
      if (this.progress(organization)?.status === "running") throw new BoardError("refresh_in_progress", "An organization PR refresh is already running. Read its progress before trying again.");
      this.db.prepare("INSERT INTO pr_refreshes(organization,run_id,epoch,state) VALUES(?,?,?,?) ON CONFLICT(organization) DO UPDATE SET run_id=excluded.run_id,epoch=excluded.epoch,state=excluded.state").run(organization, progress.id, access.epoch, JSON.stringify(progress));
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    this.verified.delete(organization);
    const boundedSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(150_000)]) : AbortSignal.timeout(150_000);
    const publish = () => {
      progress.updatedAt = this.dependencies.now().toISOString();
      this.db.prepare("UPDATE pr_refreshes SET state=? WHERE organization=? AND run_id=?").run(JSON.stringify(progress), organization, progress.id);
      try { onProgress?.({ ...progress }); } catch {}
    };
    publish();
    try {
      const collection = await this.dependencies.collect(organization, { since: new Date(Date.parse(until) - 30 * DAY).toISOString(), until, signal: boundedSignal, onProgress: value => {
        const previousPhase = progress.phase;
        progress.phase = value.phase;
        progress.completed = previousPhase === value.phase ? Math.max(progress.completed, value.completed) : value.completed;
        progress.total = value.total;
        progress.requests = Math.max(progress.requests, value.requests);
        progress.message = value.phase === "discovering" ? "Discovering organization pull requests." : "Checking review history and pull request state.";
        publish();
      } });
      let observedAccount: { id: string; login: string } | null | undefined;
      let published: { id: string; epoch: number } | undefined;
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const current = this.db.prepare("SELECT run_id,epoch FROM pr_refreshes WHERE organization=?").get(organization);
        if (this.access().epoch !== access.epoch || current?.run_id !== progress.id || Number(current.epoch) !== access.epoch) throw new BoardError("refresh_superseded", "GitHub access or the organization refresh changed. Refresh again.");
        if (collection.accessInvalidated) {
          this.invalidate();
          this.db.prepare("UPDATE pr_refreshes SET epoch=? WHERE organization=? AND run_id=?").run(this.access().epoch,organization,progress.id);
          observedAccount = null;
        } else {
          boundedSignal.throwIfAborted();
          if (collection.account) {
            if (this.access().account?.id !== collection.account.id) observedAccount = collection.account;
            let epoch = this.observeAccountInTransaction(collection.account, access.epoch);
            if (collection.scopeDenied || collection.deniedRepositories?.length) epoch = this.invalidateEvidenceInTransaction(epoch);
            const id = randomUUID();
            this.db.prepare("INSERT INTO pr_refreshes(organization,run_id,epoch,state) VALUES(?,?,?,?) ON CONFLICT(organization) DO UPDATE SET run_id=excluded.run_id,epoch=excluded.epoch,state=excluded.state").run(organization, progress.id, epoch, JSON.stringify(progress));
            this.db.prepare("INSERT INTO pr_collections(organization,id,epoch,state) VALUES(?,?,?,?) ON CONFLICT(organization) DO UPDATE SET id=excluded.id,epoch=excluded.epoch,state=excluded.state").run(organization, id, epoch, JSON.stringify(collection));
            published = { id, epoch };
          }
        }
        this.db.exec("COMMIT");
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
      if (published) this.verified.set(organization, published);
      if (observedAccount !== undefined) this.dependencies.onAccessChange?.(observedAccount);
      if (collection.scopeDenied || collection.deniedRepositories?.length) this.dependencies.onAccessDenied?.(organization,collection.scopeDenied ? null : collection.deniedRepositories!);
      if (collection.accessInvalidated) throw new BoardError("github_access_denied", collection.error ?? "GitHub access could not be verified. Check the active GitHub CLI account.");
      progress.status = collection.account ? "complete" : "failed";
      progress.phase = "finished";
      progress.finishedAt = this.dependencies.now().toISOString();
      progress.message = collection.error ?? (collection.openComplete && collection.mergedComplete && collection.detailsComplete ? "Organization pull requests refreshed." : "Organization pull requests refreshed with coverage gaps.");
      progress.requests = collection.requests;
      publish();
    } catch (error) {
      this.db.prepare("DELETE FROM pr_collections WHERE organization=? AND EXISTS(SELECT 1 FROM pr_refreshes WHERE organization=? AND run_id=?)").run(organization, organization, progress.id);
      this.verified.delete(organization);
      progress.status = signal?.aborted ? "cancelled" : "failed";
      progress.phase = "finished";
      progress.finishedAt = this.dependencies.now().toISOString();
      progress.message = error instanceof BoardError ? error.message : signal?.aborted ? "PR refresh was cancelled. Refresh again to verify GitHub access." : "PR refresh could not finish. Check organization access and refresh again.";
      publish();
      throw error instanceof BoardError ? error : new BoardError("pr_refresh_failed", progress.message);
    }
  }
  evidence(boardId: string, inferredOrganization: string | null, snapshotId: string, filter: PullRequestQueueFilter = {}): PullRequestQueueEvidence {
    this.db.exec("BEGIN");
    try {
      const evidence = this.readEvidence(boardId,inferredOrganization,snapshotId,filter);
      this.db.exec("COMMIT");
      return evidence;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  private readEvidence(boardId: string, inferredOrganization: string | null, snapshotId: string, filter: PullRequestQueueFilter): PullRequestQueueEvidence {
    const snapshot = this.read(boardId, inferredOrganization);
    if (snapshot.snapshotId !== snapshotId) throw new BoardError("stale_snapshot", "The organization PR snapshot changed. Read the queue before selecting evidence.");
    const state = filter.state ?? "open", sort = filter.sort ?? (state === "open" ? "attention" : "updated"), direction = filter.direction ?? (sort === "attention" ? "asc" : "desc");
    if (!["open", "merged"].includes(state) || !["attention", "updated", "created", "number", "title", "author", "repository"].includes(sort) || !["asc", "desc"].includes(direction)) throw new BoardError("invalid_filter", "Choose a supported pull request state, sort, and direction.");
    const collection = snapshot.account ? this.collection(snapshot.query.organization)?.collection ?? null : null;
    let rows = this.records(snapshot.query, collection).filter(pr => pr.state === state);
    if (filter.pullRequestId !== undefined) {
      rows = rows.filter(pr => pr.id === filter.pullRequestId);
      if (!rows.length) throw new BoardError("selection_not_found", "The selected PR is unavailable in this organization snapshot.");
    }
    const groups = attentionGroupCounts(rows);
    rows.sort((a, b) => {
      if (sort === "attention") return ((a.attention?.priority ?? 99) - (b.attention?.priority ?? 99)) || (direction === "asc" ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt)) || a.id.localeCompare(b.id);
      const order = sort === "number" ? a.number - b.number : sort === "updated" ? a.updatedAt.localeCompare(b.updatedAt) : sort === "created" ? a.createdAt.localeCompare(b.createdAt) : a[sort].localeCompare(b[sort]);
      return (direction === "asc" ? order : -order) || a.id.localeCompare(b.id);
    });
    const key = JSON.stringify([state, sort, direction, filter.pullRequestId ?? null]);
    let offset = 0;
    if (filter.cursor) {
      try {
        const cursor = JSON.parse(Buffer.from(filter.cursor, "base64url").toString());
        if (cursor[0] !== snapshotId || cursor[1] !== key || !Number.isSafeInteger(cursor[2]) || cursor[2] < 0) throw new Error();
        offset = cursor[2];
      } catch { throw new BoardError("invalid_cursor", "Use a cursor from this exact organization, query, snapshot, and sort."); }
    }
    return { boardId, snapshotId, query: snapshot.query, account: snapshot.account, coverage: snapshot.coverage, collectedAt: snapshot.collectedAt, needsRefresh: snapshot.needsRefresh, pullRequests: rows.slice(offset, offset + 25), totalPullRequests: rows.length, groups, nextCursor: offset + 25 < rows.length ? Buffer.from(JSON.stringify([snapshotId, key, offset + 25])).toString("base64url") : null, state, sort, direction };
  }
}
