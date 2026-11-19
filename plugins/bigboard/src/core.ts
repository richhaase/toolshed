import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { collectGitHistory, describeRepository, importNativeSources } from "./sources/git";
import { MAX_EVIDENCE_FILES } from "./shared";
import { BoardError } from "./errors";
export { BoardError } from "./errors";
import type { ActivityRecord, BoardQuery, BoardSnapshot, BoardUnchanged, CollectedWorkspace, ConfiguredRepository, EvidenceResult, GitCollectionResult, PeopleResult, PersonSummary, RefreshProgress, RepositoryCoverage, SourceConfiguration } from "./shared";

export type { EvidenceResult } from "./shared";
const DAY = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DEFAULT_QUERY: BoardQuery = { days: 7, repository: "all", compare: false };
const PAGE_SIZE = 25;

function gitPersonId(record: ActivityRecord): string {
  return `git:${Buffer.from(JSON.stringify(record.email ? ["email", record.email] : ["record", record.id])).toString("base64url")}`;
}
interface SavedBoard { version: 2; boardId: string; revision: number; updatedAt: string; query: BoardQuery }
interface Dependencies {
  now?: () => Date;
  describeRepository?: typeof describeRepository;
  importNativeSources?: typeof importNativeSources;
  collectGitHistory?: typeof collectGitHistory;
}
export interface RefreshResult { collectionId: string; collectedAt: string; configurationRevision: number; repositoryCount: number; complete: boolean; note: string }

function stateDirectory(): string {
  const configuredBase = process.env.XDG_STATE_HOME;
  const base = configuredBase && isAbsolute(configuredBase) ? configuredBase : join(homedir(), ".local", "state");
  return process.env.BIGBOARD_STATE_DIR || join(base, "bigboard-mcp-app");
}
function validateQuery(value: unknown): BoardQuery {
  const query = value as Partial<BoardQuery> | null;
  if (!query || (query.days !== 7 && query.days !== 14) || typeof query.repository !== "string" || !query.repository || typeof query.compare !== "boolean") {
    throw new BoardError("invalid_query", "Use days 7 or 14, a configured repository or all, and a boolean comparison setting.");
  }
  return { days: query.days, repository: query.repository, compare: query.compare };
}
function snapshotIdFor(boardId: string, revision: number, generation: number): string {
  return `git:${boardId}:${revision}:${generation}`;
}

function page<T>(items: T[], cursor: string | undefined, selection: (string | null)[]) {
  let offset = 0;
  if (cursor !== undefined) {
    try {
      if (cursor.length > 16384 || !/^[a-zA-Z0-9_-]+$/.test(cursor)) throw new Error();
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      if (!Array.isArray(decoded) || decoded.length !== selection.length + 1 || !selection.every((value, i) => value === decoded[i])) throw new Error();
      offset = decoded[selection.length];
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > items.length) throw new Error();
    } catch {
      throw new BoardError("invalid_cursor", "Use the nextCursor returned for this snapshot and selection.");
    }
  }
  const end = offset + PAGE_SIZE;
  return {
    items: items.slice(offset, end),
    nextCursor: end < items.length ? Buffer.from(JSON.stringify([...selection, end])).toString("base64url") : null,
  };
}

export class BoardStore {
  private database?: DatabaseSync;
  private refreshing = false;
  private deps: Required<Dependencies>;

  constructor(public readonly directory = stateDirectory(), dependencies: Dependencies = {}) {
    this.deps = { now: () => new Date(), describeRepository, importNativeSources, collectGitHistory, ...dependencies };
  }
  private db(): DatabaseSync {
    if (!this.database) {
      mkdirSync(this.directory, { recursive: true, mode: 0o700 });
      this.database = new DatabaseSync(join(this.directory, "boards.sqlite"));
      this.database.exec("PRAGMA busy_timeout = 2000; CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, state TEXT NOT NULL); CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, generation INTEGER NOT NULL, verification INTEGER NOT NULL DEFAULT 0, configuration TEXT NOT NULL, collection TEXT)");
      this.database.exec("CREATE TABLE IF NOT EXISTS refresh_progress (slot INTEGER PRIMARY KEY CHECK (slot = 1), run_id TEXT NOT NULL, configuration_revision INTEGER NOT NULL, verification INTEGER NOT NULL, state TEXT NOT NULL)");
      this.database.prepare("INSERT OR IGNORE INTO workspace (id,revision,generation,configuration) VALUES (1,0,0,?)").run(JSON.stringify({ revision: 0, repositories: [] }));
    }
    return this.database;
  }
  sources(): SourceConfiguration {
    const row = this.db().prepare("SELECT configuration FROM workspace WHERE id = 1").get()!;
    return JSON.parse(String(row.configuration)) as SourceConfiguration;
  }
  async configure(paths: string[] | undefined, importNative: boolean, expectedRevision?: number): Promise<SourceConfiguration> {
    const current = this.sources();
    if (expectedRevision !== undefined && expectedRevision !== current.revision) throw new BoardError("configuration_conflict", "Source settings changed. Call list_sources before updating them.");
    if (importNative === (paths !== undefined)) throw new BoardError("invalid_sources", "Provide paths or import_native, choosing one source of repository selection.");
    let repositories: ConfiguredRepository[];
    const signal = AbortSignal.timeout(45_000);
    try {
      if (importNative) repositories = await this.deps.importNativeSources(signal);
      else {
        repositories = [];
        for (let offset = 0; offset < paths!.length; offset += 4) {
          signal.throwIfAborted();
          repositories.push(...await Promise.all(paths!.slice(offset,offset+4).map(path => this.deps.describeRepository(path,signal))));
        }
      }
    } catch (error) {
      throw new BoardError("invalid_sources", signal.aborted ? "Repository selection import timed out. Configure explicit clone paths or narrow the native selection." : error instanceof Error ? error.message : "The repository selection could not be imported.");
    }
    const unique = new Map<string, ConfiguredRepository>();
    for (const repo of repositories) if (!unique.has(repo.id)) unique.set(repo.id, repo);
    if (unique.size > 100) throw new BoardError("too_many_sources", "Select at most 100 repositories per workspace.");
    const configuration: SourceConfiguration = { revision: current.revision + 1, repositories: [...unique.values()].sort((a,b) => a.id.localeCompare(b.id)) };
    this.db().exec("BEGIN IMMEDIATE");
    try {
      const result = this.db().prepare("UPDATE workspace SET revision=?,generation=generation+1,configuration=?,collection=NULL WHERE id=1 AND revision=?")
        .run(configuration.revision, JSON.stringify(configuration), current.revision);
      if (Number(result.changes) !== 1) throw new BoardError("configuration_conflict", "Source settings changed. Call list_sources before updating them.");
      this.db().prepare("DELETE FROM refresh_progress WHERE slot=1").run();
      const retained = new Set(configuration.repositories.map(repo => repo.id));
      for (const row of this.db().prepare("SELECT id,state FROM boards").all()) {
        try {
          const saved = JSON.parse(String(row.state));
          if (saved.query.repository !== "all" && !retained.has(saved.query.repository)) {
            saved.query.repository = "all"; saved.revision += 1; saved.updatedAt = this.deps.now().toISOString();
            this.db().prepare("UPDATE boards SET revision=?,state=? WHERE id=?").run(saved.revision, JSON.stringify(saved), String(row.id));
          }
        } catch {}
      }
      this.db().exec("COMMIT");
    } catch (error) { this.db().exec("ROLLBACK"); throw error; }
    return configuration;
  }
  async refresh(signal?: AbortSignal, onProgress?: (progress: RefreshProgress) => void): Promise<RefreshResult> {
    if (this.refreshing) throw new BoardError("refresh_in_progress", "A source refresh is already running. Read the board after it finishes.");
    const configuration = this.sources();
    if (!configuration.repositories.length) throw new BoardError("sources_required", "Configure repository paths or import the native BigBoard selection before refreshing.");
    const until = this.deps.now().toISOString();
    const progress: RefreshProgress = { id: randomUUID(), status: "running", startedAt: until, updatedAt: until, finishedAt: null, git: { completedRepositories: 0, totalRepositories: configuration.repositories.length }, message: "Collecting Git history." };
    let refreshEpoch: number;
    this.db().exec("BEGIN IMMEDIATE");
    try {
      const started = this.db().prepare("UPDATE workspace SET verification=verification+1 WHERE id=1 AND revision=? RETURNING verification").get(configuration.revision);
      if (!started) throw new BoardError("configuration_conflict", "Source settings changed. Read the settings and retry refresh.");
      refreshEpoch = Number(started.verification);
      this.db().prepare("INSERT INTO refresh_progress (slot,run_id,configuration_revision,verification,state) VALUES (1,?,?,?,?) ON CONFLICT(slot) DO UPDATE SET run_id=excluded.run_id,configuration_revision=excluded.configuration_revision,verification=excluded.verification,state=excluded.state")
        .run(progress.id, configuration.revision, refreshEpoch, JSON.stringify(progress));
      this.db().exec("COMMIT");
    } catch (error) { this.db().exec("ROLLBACK"); throw error; }
    const since = new Date(Date.parse(until) - 28 * DAY).toISOString();
    const boundedSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(150_000)]) : AbortSignal.timeout(150_000);
    const notifyProgress = () => {
      try { onProgress?.({ ...progress, git: { ...progress.git } }); }
      catch {}
    };
    const publishProgress = () => {
      progress.updatedAt = this.deps.now().toISOString();
      this.db().prepare("UPDATE refresh_progress SET state=? WHERE slot=1 AND run_id=?")
        .run(JSON.stringify(progress), progress.id);
      notifyProgress();
    };
    const finishProgress = (status: RefreshProgress["status"], message: string) => {
      progress.status = status;
      progress.message = message;
      progress.finishedAt = this.deps.now().toISOString();
      publishProgress();
    };
    this.refreshing = true;
    notifyProgress();
    try {
      const git: GitCollectionResult[] = [];
      const queue = [...configuration.repositories];
      await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
        for (let repo = queue.shift(); repo; repo = queue.shift()) {
          boundedSignal.throwIfAborted();
          try { git.push(await this.deps.collectGitHistory(repo, { since, until, signal: boundedSignal })); }
          catch { git.push({ repository: repo, revision: null, ref: `refs/remotes/${repo.remote}/${repo.defaultBranch}`, shallow: false, partial: false, complete: false, linesComplete: false, records: [], error: "Git history could not be read. Check the selected clone and default remote branch." }); }
          if (progress.status === "running") {
            progress.git.completedRepositories += 1;
            publishProgress();
          }
        }
      }));
      boundedSignal.throwIfAborted();
      const collection: CollectedWorkspace = { id: randomUUID(), configRevision: configuration.revision, generatedAt: this.deps.now().toISOString(), since, until, git: git.sort((a,b) => a.repository.id.localeCompare(b.repository.id)) };
      const result = this.db().prepare("UPDATE workspace SET collection=?,generation=generation+1 WHERE id=1 AND revision=? AND verification=?")
        .run(JSON.stringify(collection), configuration.revision, refreshEpoch);
      if (Number(result.changes) !== 1) throw new BoardError("refresh_superseded", "Source settings or collected data changed while refreshing. Read the board and refresh again if needed.");
      const coverage = this.coverage(configuration.repositories, collection);
      const complete = coverage.every(repo => repo.historyComplete && repo.linesComplete);
      finishProgress("complete", complete ? "Sources refreshed." : "Sources refreshed with coverage gaps. Check source coverage for details.");
      return { collectionId: collection.id, collectedAt: collection.generatedAt, configurationRevision: configuration.revision, repositoryCount: configuration.repositories.length, complete, note: complete ? "Git history collection completed." : "Collection completed with coverage gaps; inspect the board's repository coverage." };
    } catch (error) {
      finishProgress(signal?.aborted ? "cancelled" : "failed", error instanceof BoardError && error.code === "refresh_superseded" ? "Refresh was superseded by newer source settings or another refresh." : signal?.aborted ? "Source refresh was cancelled. Previous Git evidence remains available." : boundedSignal.aborted ? "Source refresh timed out. Previous Git evidence remains available." : "Source refresh could not finish. Check source coverage and retry.");
      if (error instanceof BoardError) throw error;
      throw new BoardError("refresh_cancelled", "Source refresh was cancelled or timed out. Previous Git evidence remains available.");
    } finally { this.refreshing = false; }
  }
  private progress(state: unknown): RefreshProgress | null {
    if (state === null) return null;
    const progress: RefreshProgress = JSON.parse(String(state));
    if ("github" in progress) return null;
    const deadline = Date.parse(progress.startedAt) + 180_000;
    if (progress.status === "running" && this.deps.now().getTime() >= deadline) {
      return { ...progress, status: "failed", finishedAt: new Date(deadline).toISOString(), message: "Source refresh was interrupted or exceeded its time limit. Refresh again to collect sources." };
    }
    return progress;
  }
  private workspace() {
    const row = this.db().prepare("SELECT workspace.configuration,workspace.collection,workspace.generation,refresh_progress.state AS refresh FROM workspace LEFT JOIN refresh_progress ON refresh_progress.slot=1 AND refresh_progress.configuration_revision=workspace.revision AND refresh_progress.verification=workspace.verification WHERE workspace.id=1").get()!;
    try {
      return {
        generation: Number(row.generation),
        configuration: JSON.parse(String(row.configuration)) as SourceConfiguration,
        collection: row.collection === null ? null : JSON.parse(String(row.collection)) as CollectedWorkspace,
        refresh: this.progress(row.refresh),
      };
    } catch { throw new BoardError("collection_unreadable", "The collected evidence could not be read. Reconfigure sources to rebuild it."); }
  }
  private load(boardId: string): SavedBoard {
    if (!UUID.test(boardId)) throw new BoardError("invalid_board_id", "Use the boardId returned by open_board.");
    const row = this.db().prepare("SELECT revision,state FROM boards WHERE id=?").get(boardId);
    if (!row) throw new BoardError("board_not_found", "This board was not found. Call open_board without an ID to create one.");
    try {
      const saved = JSON.parse(String(row.state));
      if ((saved.version !== 1 && saved.version !== 2) || saved.boardId !== boardId || !Number.isSafeInteger(saved.revision) || saved.revision < 1 || saved.revision !== row.revision || !Number.isFinite(Date.parse(saved.updatedAt))) throw new Error();
      if (saved.version === 1) {
        saved.version = 2; saved.query.repository = "all"; saved.revision += 1;
        saved.updatedAt = this.deps.now().toISOString();
        this.db().prepare("UPDATE boards SET revision=?,state=? WHERE id=? AND revision=?").run(saved.revision, JSON.stringify(saved), boardId, row.revision);
        return this.load(boardId);
      }
      return { ...saved, query: validateQuery(saved.query) };
    } catch { throw new BoardError("board_unreadable", "The saved board could not be read. Create a new board to continue."); }
  }
  private coverage(repos: ConfiguredRepository[], collection: CollectedWorkspace | null): RepositoryCoverage[] {
    return repos.map(repo => {
      const git = collection?.git.find(value => value.repository.id === repo.id);
      return {
        repository: repo.id, revision: git?.revision ?? null, ref: git?.ref ?? `refs/remotes/${repo.remote}/${repo.defaultBranch}`,
        shallow: git?.shallow ?? false, partial: git?.partial ?? false, historyComplete: git?.complete ?? false,
        linesComplete: git?.linesComplete ?? false, errors: git?.error ? [git.error] : [],
      };
    });
  }
  private snapshot(saved: SavedBoard, workspace = this.workspace()): BoardSnapshot {
    const config = workspace.configuration;
    const collection = workspace.collection;
    const until = collection?.until ?? saved.updatedAt;
    const since = new Date(Date.parse(until) - saved.query.days * DAY).toISOString();
    const previousSince = new Date(Date.parse(since) - saved.query.days * DAY).toISOString();
    const repos = config.repositories.filter(repo => saved.query.repository === "all" || repo.id === saved.query.repository);
    const ids = new Set(repos.map(repo => repo.id));
    const coverage = this.coverage(repos, collection);
    const records = (collection?.git ?? []).filter(value => ids.has(value.repository.id)).flatMap(value => value.records);
    const current = records.filter(record => record.timestamp >= since && record.timestamp < until);
    const priorCovered = Boolean(collection && collection.since <= previousSince && repos.length && coverage.every(repo => repo.historyComplete));
    const previous = saved.query.compare && priorCovered ? records.filter(record => record.timestamp >= previousSince && record.timestamp < since) : null;
    const complete = Boolean(collection && repos.length && coverage.every(repo => repo.historyComplete && repo.linesComplete));
    const buckets = Array.from({ length: saved.query.days }, (_, index) => {
      const start = new Date(Date.parse(since) + index * DAY).toISOString();
      const end = new Date(Date.parse(start) + DAY).toISOString();
      const selected = current.filter(record => record.timestamp >= start && record.timestamp < end);
      const priorStart = new Date(Date.parse(start) - saved.query.days * DAY).toISOString();
      const priorEnd = new Date(Date.parse(end) - saved.query.days * DAY).toISOString();
      return {
        start, end, commits: selected.length,
        additions: selected.reduce((sum, record) => sum + (record.additions ?? 0), 0),
        deletions: selected.reduce((sum, record) => sum + (record.deletions ?? 0), 0),
        unknownLineCommits: selected.filter(record => record.additions === null || record.deletions === null).length,
        previousCommits: previous?.filter(record => record.timestamp >= priorStart && record.timestamp < priorEnd).length ?? null,
        recordIds: selected.slice(0, 30).map(record => record.id), recordIdsTruncated: selected.length > 30,
      };
    });
    const needsRefresh = !collection || collection.configRevision !== config.revision;
    const note = !config.repositories.length ? "Configure local clone paths or import the native BigBoard selection, then refresh sources."
      : !collection ? "Refresh sources to collect Git history."
      : `Git activity uses author dates from local remote-tracking default branches. ${complete ? "Coverage is complete." : "Coverage is incomplete. Reported counts may be lower bounds."}`;
    return {
      refresh: workspace.refresh, boardId: saved.boardId, revision: saved.revision,
      snapshotId: snapshotIdFor(saved.boardId, saved.revision, workspace.generation),
      updatedAt: saved.updatedAt, query: saved.query, scope: { since, until, timezone: "UTC" },
      coverage: { source: "git", complete, note, repositories: coverage },
      configuration: { revision: config.revision, repositories: config.repositories.map(repo => repo.id), needsRefresh },
      collectedAt: collection?.generatedAt ?? null, buckets,
      totals: {
        commits: current.length, additions: current.reduce((sum, r) => sum + (r.additions ?? 0), 0),
        deletions: current.reduce((sum, r) => sum + (r.deletions ?? 0), 0),
        unknownLineCommits: current.filter(r => r.additions === null || r.deletions === null).length,
        previousCommits: previous?.length ?? null,
      },
    };
  }
  async open(boardId?: string): Promise<BoardSnapshot> {
    if (boardId !== undefined) return this.read(boardId);
    const saved: SavedBoard = { version: 2, boardId: randomUUID(), revision: 1, updatedAt: this.deps.now().toISOString(), query: { ...DEFAULT_QUERY } };
    this.db().prepare("INSERT INTO boards (id,revision,state) VALUES (?,?,?)").run(saved.boardId,saved.revision,JSON.stringify(saved));
    return this.snapshot(saved);
  }
  async read(boardId: string): Promise<BoardSnapshot>;
  async read(boardId: string, knownSnapshotId?: string): Promise<BoardSnapshot | BoardUnchanged>;
  async read(boardId: string, knownSnapshotId?: string): Promise<BoardSnapshot | BoardUnchanged> {
    if (knownSnapshotId !== undefined) {
      const row = this.db().prepare("SELECT boards.revision, workspace.generation, refresh_progress.state AS refresh FROM boards CROSS JOIN workspace LEFT JOIN refresh_progress ON refresh_progress.slot=1 AND refresh_progress.configuration_revision=workspace.revision AND refresh_progress.verification=workspace.verification WHERE boards.id=? AND workspace.id=1").get(boardId);
      if (row && knownSnapshotId === snapshotIdFor(boardId, Number(row.revision), Number(row.generation))) {
        return { unchanged: true, snapshotId: knownSnapshotId, refresh: this.progress(row.refresh) };
      }
    }
    const { saved, workspace } = this.boardState(boardId);
    return this.snapshot(saved, workspace);
  }
  async update(boardId: string, expectedRevision: number, patch: Partial<BoardQuery>): Promise<BoardSnapshot> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new BoardError("invalid_revision", "Use the revision returned by read_board.");
    const saved = this.load(boardId);
    if (saved.revision !== expectedRevision) this.conflict(saved.revision);
    const query = validateQuery({ ...saved.query, ...patch });
    if (query.repository !== "all" && !this.sources().repositories.some(repo => repo.id === query.repository)) throw new BoardError("repository_not_configured", "Choose a repository returned by list_sources.");
    if (JSON.stringify(query) === JSON.stringify(saved.query)) return this.snapshot(saved);
    const next: SavedBoard = { ...saved,query,revision:saved.revision+1,updatedAt:this.deps.now().toISOString() };
    const changed = this.db().prepare("UPDATE boards SET revision=?,state=? WHERE id=? AND revision=?").run(next.revision,JSON.stringify(next),boardId,expectedRevision);
    if (Number(changed.changes) !== 1) this.conflict(this.load(boardId).revision);
    return this.snapshot(next);
  }
  private conflict(revision: number): never { throw new BoardError("revision_conflict", `Board revision ${revision} is current. Call read_board, then retry with that revision.`); }
  private boardState(boardId: string) {
    const db = this.db();
    db.exec("BEGIN");
    try {
      const saved = this.load(boardId);
      const workspace = this.workspace();
      db.exec("COMMIT");
      return { saved, workspace };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  private selection(boardId: string, snapshotId: string, bucketStart?: string) {
    const { saved, workspace } = this.boardState(boardId);
    const board = this.snapshot(saved, workspace);
    if (board.snapshotId !== snapshotId) throw new BoardError("stale_snapshot", "The selected evidence changed. Read the board and select the current snapshot.");
    const bucket = bucketStart === undefined ? undefined : board.buckets.find(value => value.start === bucketStart);
    if (bucketStart !== undefined && !bucket) throw new BoardError("invalid_selection", "The selected bucket is outside this board's scope.");
    const since = bucket?.start ?? board.scope.since;
    const until = bucket?.end ?? board.scope.until;
    const repositoryIds = new Set(board.coverage.repositories.map(repo => repo.repository));
    const records = (workspace.collection?.git ?? [])
      .filter(repo => repositoryIds.has(repo.repository.id))
      .flatMap(repo => repo.records)
      .filter(record => record.timestamp >= since && record.timestamp < until)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp) || a.id.localeCompare(b.id));
    return { board, records };
  }
  async people(boardId: string, snapshotId: string, cursor?: string): Promise<PeopleResult> {
    const { board, records } = this.selection(boardId, snapshotId);
    const people = new Map<string, PersonSummary>();
    for (const record of records) {
      const id = gitPersonId(record);
      let person = people.get(id);
      if (!person) {
        person = { id, name: record.contributor, identity: record.email || "Email unavailable", commits: 0, additions: 0, deletions: 0, unknownLineCommits: 0, repositories: [] };
        people.set(id, person);
      }
      if (!person.repositories.includes(record.repository)) person.repositories.push(record.repository);
      person.commits++;
      person.additions += record.additions ?? 0;
      person.deletions += record.deletions ?? 0;
      person.unknownLineCommits += Number(record.additions === null || record.deletions === null);
    }
    const sorted = [...people.values()].sort((a, b) => b.commits - a.commits || a.identity.localeCompare(b.identity) || a.id.localeCompare(b.id));
    const result = page(sorted, cursor, ["people", snapshotId]);
    for (const person of result.items) person.repositories.sort();
    return {
      boardId, revision: board.revision, snapshotId, query: board.query, scope: board.scope, coverage: board.coverage,
      people: result.items, totalPeople: sorted.length, nextCursor: result.nextCursor,
    };
  }
  async evidence(boardId: string, snapshotId: string, bucketStart?: string, cursor?: string, personId?: string): Promise<EvidenceResult> {
    const selection = this.selection(boardId, snapshotId, bucketStart);
    const { board } = selection;
    const records = personId === undefined ? selection.records : selection.records.filter(record => gitPersonId(record) === personId);
    if (personId !== undefined && records.length === 0) throw new BoardError("selection_not_found", "The selected contributor has no evidence in this scope. Refresh the selection before discussing it.");
    const result = page(records, cursor, ["evidence", snapshotId, bucketStart ?? null, personId ?? null]);
    return {
      boardId, revision: board.revision, snapshotId, query: board.query, scope: board.scope, coverage: board.coverage,
      bucketStart: bucketStart ?? null, selectedPersonId: personId, totalRecords: records.length, nextCursor: result.nextCursor,
      records: result.items.map(record => ({
        ...record, files: record.files.slice(0, MAX_EVIDENCE_FILES),
        filesTruncated: record.filesTruncated === true || record.files.length > MAX_EVIDENCE_FILES,
      })),
    };
  }
  close(): void { this.database?.close(); this.database = undefined; }
}
