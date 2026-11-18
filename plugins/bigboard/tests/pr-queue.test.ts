import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test, type TestContext } from "node:test";
import { BoardError, BoardStore } from "../src/core";
import type { OrganizationCollectionOptions, OrganizationPullRequestCollection, QueueCollectedPullRequest } from "../src/pr-queue-types";

const NOW = new Date("2026-11-17T12:00:00.000Z");
const account = { id: "100", login: "fixture-viewer" };
const code = (value: string) => (error: unknown) => error instanceof BoardError && error.code === value;
function pr(number: number, requested = false): QueueCollectedPullRequest {
  return { id: `example/widget#${number}`, repository: "example/widget", number, title: `Work ${number}`, url: `https://github.com/example/widget/pull/${number}`, author: "fixture-author", state: "open", draft: false, createdAt: "2025-01-01T00:00:00.000Z", updatedAt: new Date(NOW.getTime() - number * 1000).toISOString(), mergedAt: null, baseBranch: "main", headSha: number.toString(16).padStart(40,"0"), review: { decision: "none", requestedReviewers: requested ? [account.login] : [], requestedTeams: [], assignees: [], reviewRequestsComplete: true, assigneesComplete: true } };
}
function collection(organization: string, records: QueueCollectedPullRequest[] = [pr(1)]): OrganizationPullRequestCollection {
  return { organization, account, collectedAt: NOW.toISOString(), pullRequests: records, openComplete: true, mergedComplete: true, detailsComplete: false, error: null, accessInvalidated: false, requests: 4 };
}
async function setup(t: TestContext, collector: (organization: string, options: OrganizationCollectionOptions) => Promise<OrganizationPullRequestCollection> = async organization => collection(organization)) {
  const directory = await mkdtemp(join(tmpdir(),"bigboard-queue-"));
  t.after(() => rm(directory,{ recursive: true, force: true }));
  const calls = { git: 0, github: 0 };
  const dependencies = { now: () => NOW, collectOrganizationPullRequests: collector,
    collectGitHistory: async () => { calls.git += 1; throw new Error("PR queue must not collect Git history"); },
    collectGitHub: async () => { calls.github += 1; throw new Error("PR queue must not collect configured repositories"); } };
  return { directory, dependencies, calls, store: new BoardStore(directory,dependencies) };
}

test("organization PRs work without clones and keep history queries and snapshots independent", async t => {
  const { store, calls } = await setup(t);
  const history = await store.open(undefined,"example");
  assert.deepEqual(store.sources().repositories,[]);
  const query = store.readPullRequestQueue(history.boardId);
  assert.equal(query.query.organization,"example");
  const refreshed = await store.refreshPullRequests(history.boardId);
  assert.equal(refreshed.account?.login,account.login);
  assert.equal(refreshed.totals.open,1);
  assert.deepEqual(calls,{ git: 0, github: 0 });
  const before = await store.read(history.boardId);
  assert.equal(before.snapshotId,history.snapshotId);
  const changed = store.updatePullRequestQueue(history.boardId,refreshed.revision,{ attention: "mine", days: 30, repository: "example/widget" });
  assert.equal(changed.totals.open,0);
  const after = await store.read(history.boardId);
  assert.equal(after.snapshotId,history.snapshotId);
  assert.deepEqual(after.query,history.query);
  const historyChanged = await store.update(history.boardId,history.revision,{ days: 14, compare: true });
  assert.equal(historyChanged.pullRequestQueue?.snapshotId,changed.snapshotId);
  assert.deepEqual(historyChanged.pullRequestQueue?.query,changed.query);
});

test("attention priority is applied across the full inventory before paging and selection cursors bind query and sort", async t => {
  const records = Array.from({ length: 61 },(_,index) => pr(index + 1,index === 58));
  const { store } = await setup(t,async organization => collection(organization,records));
  const board = await store.open(undefined,"example");
  const snapshot = await store.refreshPullRequests(board.boardId);
  const first = store.queryPullRequests(board.boardId,snapshot.snapshotId);
  assert.equal(first.totalPullRequests,61);
  assert.equal(first.pullRequests.length,25);
  assert.equal(first.pullRequests[0].number,59);
  assert.equal(first.pullRequests[0].attention?.group,"awaiting_review");
  assert.equal(first.pullRequests[0].headSha,records[58].headSha);
  assert.equal("workflow" in first.pullRequests[0],false);
  const second = store.queryPullRequests(board.boardId,snapshot.snapshotId,{ cursor: first.nextCursor! });
  assert.equal(new Set([...first.pullRequests,...second.pullRequests].map(pr => pr.id)).size,50);
  assert.throws(() => store.queryPullRequests(board.boardId,snapshot.snapshotId,{ sort: "updated", cursor: first.nextCursor! }),code("invalid_cursor"));
  const exact = store.queryPullRequests(board.boardId,snapshot.snapshotId,{ pullRequestId: records[58].id });
  assert.equal(exact.pullRequests.length,1);
  assert.equal(exact.pullRequests[0].headSha,records[58].headSha);
  store.updatePullRequestQueue(board.boardId,snapshot.revision,{ attention: "review" });
  assert.throws(() => store.queryPullRequests(board.boardId,snapshot.snapshotId),code("stale_snapshot"));
});

test("unknown review states and old drafts remain visible in whole-organization mode", async t => {
  const records = [pr(1),{ ...pr(2),author: account.login,draft: true },{ ...pr(3),review: undefined }];
  const { store } = await setup(t,async organization => collection(organization,records));
  const board = await store.open(undefined,"example");
  const snapshot = await store.refreshPullRequests(board.boardId);
  const result = store.queryPullRequests(board.boardId,snapshot.snapshotId);
  assert.equal(result.totalPullRequests,3);
  assert.ok(result.pullRequests.some(row => row.draft && row.author === account.login));
  assert.ok(result.pullRequests.every(row => row.attention?.incomplete));
  assert.equal(snapshot.coverage.detailsComplete,false);
});

test("PR queries use independent CAS and persisted organization scope survives source configuration changes", async t => {
  const { directory, dependencies, store } = await setup(t);
  const board = await store.open(undefined,"example");
  const other = new BoardStore(directory,dependencies);
  const current = other.readPullRequestQueue(board.boardId);
  const saved = store.updatePullRequestQueue(board.boardId,current.revision,{ repository: "example/widget" });
  assert.throws(() => other.updatePullRequestQueue(board.boardId,current.revision,{ attention: "review" }),code("revision_conflict"));
  assert.throws(() => other.updatePullRequestQueue(board.boardId,-1,{ attention: "all" }),code("invalid_revision"));
  assert.throws(() => other.updatePullRequestQueue(board.boardId,saved.revision,{ organization: "bad org" }),code("invalid_organization"));
  assert.throws(() => other.updatePullRequestQueue(board.boardId,saved.revision,{ repository: "different/widget" }),code("invalid_repository"));
  const changed = other.updatePullRequestQueue(board.boardId,saved.revision,{ organization: "another" });
  assert.equal(changed.query.repository,"all");
  assert.equal(changed.query.organization,"another");
  const config = store.sources();
  await store.configure([],false,config.revision);
  assert.equal(store.readPullRequestQueue(board.boardId).query.organization,"another");
});

test("restarting hides cached organization evidence until that session verifies access", async t => {
  const { directory, dependencies, store } = await setup(t);
  const board = await store.open(undefined,"example");
  await store.refreshPullRequests(board.boardId);
  const restarted = new BoardStore(directory,dependencies);
  const hidden = restarted.readPullRequestQueue(board.boardId);
  assert.equal(hidden.account,null);
  assert.equal(hidden.totals.open,0);
  assert.equal(hidden.needsRefresh,true);
  assert.deepEqual(restarted.queryPullRequests(board.boardId,hidden.snapshotId).pullRequests,[]);
  const refreshed = await restarted.refreshPullRequests(board.boardId);
  assert.equal(refreshed.totals.open,1);
});

test("organization changes clear old-account evidence and invalidate stale cached queues", async t => {
  let login = account;
  const { store } = await setup(t,async organization => ({ ...collection(organization), account: login }));
  const board = await store.open(undefined,"example");
  const old = await store.refreshPullRequests(board.boardId);
  const second = await store.open(undefined,"another");
  login = { id: "200",login: "another-viewer" };
  await store.refreshPullRequests(second.boardId);
  const invalidated = store.readPullRequestQueue(board.boardId);
  assert.equal(invalidated.account,null);
  assert.equal(invalidated.totals.open,0);
  assert.throws(() => store.queryPullRequests(board.boardId,old.snapshotId),code("stale_snapshot"));
});

test("an auth-denied refresh invalidates organization caches in other SQLite instances", async t => {
  let deny = false;
  const { directory, dependencies, store } = await setup(t,async organization => deny ? { ...collection(organization), account: null,pullRequests: [], accessInvalidated: true,error: "GitHub authentication is unavailable." } : collection(organization));
  const board = await store.open(undefined,"example");
  const prior = await store.refreshPullRequests(board.boardId);
  const other = new BoardStore(directory,dependencies);
  deny = true;
  await assert.rejects(other.refreshPullRequests(board.boardId),code("github_access_denied"));
  const current = store.readPullRequestQueue(board.boardId);
  assert.equal(current.account,null);
  assert.equal(current.totals.open,0);
  assert.throws(() => store.queryPullRequests(board.boardId,prior.snapshotId),code("stale_snapshot"));
});

test("a refresh coalesces across boards in one process and exposes GitHub-only progress", async t => {
  let release!: () => void;
  const blocked = new Promise<void>(done => { release = done; });
  let calls = 0;
  const { store } = await setup(t,async (organization,options) => {
    calls += 1;
    options.onProgress?.({ phase: "details",completed: 1,total: 3,requests: 3 });
    await blocked;
    return collection(organization);
  });
  const a = await store.open(undefined,"example"), b = await store.open(undefined,"example");
  const first = store.refreshPullRequests(a.boardId);
  const second = store.refreshPullRequests(b.boardId);
  const progress = store.readPullRequestQueue(a.boardId).refresh!;
  assert.equal(progress.status,"running");
  assert.equal(progress.phase,"details");
  assert.equal(progress.completed,1);
  assert.equal(progress.total,3);
  release();
  const results = await Promise.all([first,second]);
  assert.equal(calls,1);
  assert.equal(results[0].boardId,a.boardId);
  assert.equal(results[1].boardId,b.boardId);
  assert.equal(results[0].refresh?.status,"complete");
});

test("cancellation never republishes old organization records", async t => {
  const controller = new AbortController();
  const { store } = await setup(t,async organization => { controller.abort(); return collection(organization); });
  const board = await store.open(undefined,"example");
  await assert.rejects(store.refreshPullRequests(board.boardId,controller.signal),code("pr_refresh_failed"));
  const current = store.readPullRequestQueue(board.boardId);
  assert.equal(current.totals.open,0);
  assert.equal(current.refresh?.status,"cancelled");
});

test("merged My work retains authored PRs independently of open attention classification", async t => {
  const records = [ { ...pr(1),author: account.login,state: "merged" as const,mergedAt: "2026-11-16T12:00:00.000Z" }, { ...pr(2),state: "merged" as const,mergedAt: "2026-11-16T12:00:00.000Z" } ];
  const { store } = await setup(t,async organization => collection(organization,records));
  const board = await store.open(undefined,"example");
  const refreshed = await store.refreshPullRequests(board.boardId);
  const snapshot = store.updatePullRequestQueue(board.boardId,refreshed.revision,{ attention: "mine" });
  const result = store.queryPullRequests(board.boardId,snapshot.snapshotId,{ state: "merged" });
  assert.deepEqual(result.pullRequests.map(pr => pr.author),[account.login]);
});

test("an old source refresh cannot replace a newer organization account on its first collection", async t => {
  const { directory } = await setup(t);
  let release!: () => void;
  const blocked = new Promise<void>(done => { release = done; });
  const repository = { id: "example/widget",path: "/example/widget",remote: "origin",defaultBranch: "main" };
  const newer = { id: "200",login: "fixture-newer" };
  const store = new BoardStore(directory,{ now: () => NOW,describeRepository: async () => repository,
    collectGitHistory: async () => ({ repository,revision: "a".repeat(40),ref: "refs/remotes/origin/main",shallow: false,partial: false,complete: true,linesComplete: true,records: [],error: null }),
    collectGitHub: async () => { await blocked; return { account,repositories: [],pullRequests: [],error: null }; },
    collectOrganizationPullRequests: async organization => ({ ...collection(organization),account: newer }) });
  await store.configure([repository.path],false,0);
  const board = await store.open(undefined,"example");
  const oldRefresh = store.refresh();
  const queue = await store.refreshPullRequests(board.boardId);
  assert.equal(queue.account?.id,newer.id);
  release();
  await assert.rejects(oldRefresh,code("refresh_superseded"));
  assert.equal(store.readPullRequestQueue(board.boardId).account?.id,newer.id);
  assert.equal((await store.read(board.boardId)).account,null);
});

test("a late denied refresh cannot invalidate another instance's newer verified account", async t => {
  let release!: () => void;
  const blocked = new Promise<void>(done => { release = done; });
  const { directory,store } = await setup(t,async organization => { await blocked; return { ...collection(organization),account: null,pullRequests: [],accessInvalidated: true,error: "GitHub authentication is unavailable." }; });
  const a = await store.open(undefined,"example");
  const old = store.refreshPullRequests(a.boardId);
  const newer = { id: "200",login: "fixture-newer" };
  const other = new BoardStore(directory,{ now: () => NOW,collectOrganizationPullRequests: async organization => ({ ...collection(organization),account: newer }) });
  const b = await other.open(undefined,"another");
  const fresh = await other.refreshPullRequests(b.boardId);
  release();
  await assert.rejects(old,code("refresh_superseded"));
  assert.equal(other.readPullRequestQueue(b.boardId).account?.id,newer.id);
  assert.equal(other.readPullRequestQueue(b.boardId).snapshotId,fresh.snapshotId);
});

test("evidence reads keep one SQLite snapshot while another connection changes account and collection", async t => {
  const { directory,store } = await setup(t);
  const board = await store.open(undefined,"example");
  const snapshot = await store.refreshPullRequests(board.boardId);
  const writer = new DatabaseSync(join(directory,"boards.sqlite"));
  t.after(() => writer.close());
  writer.exec("PRAGMA journal_mode=WAL");
  const internals = store as unknown as { queue: { collection: (organization: string | null) => unknown } };
  const original = internals.queue.collection.bind(internals.queue);
  let reads = 0;
  internals.queue.collection = organization => {
    reads += 1;
    if (reads === 2) {
      const nextAccount = { id: "200",login: "fixture-newer" };
      const changed = { ...collection("example",[{ ...pr(2),author: nextAccount.login }]),account: nextAccount };
      writer.exec("BEGIN IMMEDIATE");
      writer.prepare("UPDATE pr_access SET epoch=epoch+1,account=? WHERE id=1").run(JSON.stringify(nextAccount));
      writer.prepare("UPDATE pr_collections SET id='newer-collection',epoch=(SELECT epoch FROM pr_access WHERE id=1),state=? WHERE organization='example'").run(JSON.stringify(changed));
      writer.exec("COMMIT");
    }
    return original(organization);
  };
  const evidence = store.queryPullRequests(board.boardId,snapshot.snapshotId);
  assert.equal(evidence.account?.id,account.id);
  assert.deepEqual(evidence.pullRequests.map(pr => pr.author),["fixture-author"]);
  assert.equal(store.readPullRequestQueue(board.boardId).account,null);
});

test("known repository access denial invalidates cached PRs across history and organization surfaces", async t => {
  const { directory } = await setup(t);
  const repository = { id: "example/widget",path: "/example/widget",remote: "origin",defaultBranch: "main" };
  let deniedBySource = false, deniedByQueue = false;
  const store = new BoardStore(directory,{ now: () => NOW,describeRepository: async () => repository,
    collectGitHistory: async () => ({ repository,revision: "a".repeat(40),ref: "refs/remotes/origin/main",shallow: false,partial: false,complete: true,linesComplete: true,records: [],error: null }),
    collectGitHub: async () => ({ account,repositories: [{ id: repository.id,openComplete: !deniedBySource,mergedComplete: !deniedBySource,reviewComplete: !deniedBySource,accessDenied: deniedBySource,error: deniedBySource ? "Repository access denied." : null }],pullRequests: deniedBySource ? [] : [pr(1)],error: null }),
    collectOrganizationPullRequests: async organization => deniedByQueue ? { ...collection(organization,[]),openComplete: false,detailsComplete: false,deniedRepositories: [repository.id],error: "Repository access denied." } : collection(organization) });
  await store.configure([repository.path],false,0);
  const board = await store.open(undefined,"example");
  await store.refresh();
  await store.refreshPullRequests(board.boardId);
  assert.equal(store.readPullRequestQueue(board.boardId).totals.open,1);
  deniedBySource = true;
  await store.refresh();
  assert.equal(store.readPullRequestQueue(board.boardId).totals.open,0);
  deniedBySource = false;
  await store.refresh();
  await store.refreshPullRequests(board.boardId);
  assert.equal((await store.read(board.boardId)).totals.openPRs,1);
  deniedByQueue = true;
  await store.refreshPullRequests(board.boardId);
  assert.equal((await store.read(board.boardId)).totals.openPRs,0);
  assert.equal(store.readPullRequestQueue(board.boardId).totals.open,0);
});

test("known same-account repository denial prevents an older first history refresh from publishing", async t => {
  const { directory } = await setup(t);
  const repository = { id: "example/widget",path: "/example/widget",remote: "origin",defaultBranch: "main" };
  let release!: () => void;
  const blocked = new Promise<void>(done => { release = done; });
  let denied = false;
  const store = new BoardStore(directory,{ now: () => NOW,describeRepository: async () => repository,
    collectGitHistory: async () => ({ repository,revision: "a".repeat(40),ref: "refs/remotes/origin/main",shallow: false,partial: false,complete: true,linesComplete: true,records: [],error: null }),
    collectGitHub: async () => { await blocked; return { account,repositories: [],pullRequests: [pr(1)],error: null }; },
    collectOrganizationPullRequests: async organization => denied ? { ...collection(organization,[]),deniedRepositories: [repository.id],openComplete: false,error: "Repository access denied." } : collection(organization) });
  await store.configure([repository.path],false,0);
  const board = await store.open(undefined,"example");
  await store.refreshPullRequests(board.boardId);
  const old = store.refresh();
  denied = true;
  await store.refreshPullRequests(board.boardId);
  release();
  await assert.rejects(old,code("refresh_superseded"));
  assert.equal((await store.read(board.boardId)).totals.openPRs,0);
  assert.equal(store.readPullRequestQueue(board.boardId).totals.open,0);
});
