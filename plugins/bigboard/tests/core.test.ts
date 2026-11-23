import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test, type TestContext } from "node:test";
import { BoardError, BoardStore } from "../src/core";
import type { ActivityRecord, ConfiguredRepository, GitCollectionResult, RefreshProgress } from "../src/shared";

const DAY = 86_400_000;
const NOW = new Date("2026-11-17T12:00:00.000Z");
const repos: ConfiguredRepository[] = [
  { id: "example/widget", path: "/example/widget", remote: "origin", defaultBranch: "main" },
  { id: "example/other", path: "/example/other", remote: "origin", defaultBranch: "main" },
];
const code = (expected: string) => (error: unknown) => error instanceof BoardError && error.code === expected;
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

function commit(repository: string, index: number, timestamp: string): ActivityRecord {
  const sha = (index + 1).toString(16).padStart(40, "0");
  return { id: `${repository}@${sha}`, repository, sha, timestamp, subject: `Change ${index}`, contributor: "Contributor A", email: "a@example.invalid", additions: 10, deletions: 2, files: [{ path: "source.txt", additions: 10, deletions: 2 }], url: `https://github.com/${repository}/commit/${sha}` };
}
function fixtures() {
  let records = repos.flatMap((repo, repoIndex) => Array.from({ length: 28 }, (_, day) => commit(repo.id, repoIndex * 100 + day, new Date(NOW.getTime() - (day + 0.5) * DAY).toISOString())));
  const calls = { describe: 0, native: 0, git: 0 };
  let beforeGit: (() => Promise<void>) | undefined;
  const dependencies = {
    now: () => NOW,
    describeRepository: async (path: string) => { calls.describe += 1; return repos.find(repo => repo.path === path)!; },
    importNativeSources: async () => { calls.native += 1; return [...repos, repos[0]]; },
    collectGitHistory: async (repository: ConfiguredRepository, options: { since: string; until: string }): Promise<GitCollectionResult> => {
      calls.git += 1;
      assert.equal(Date.parse(options.until) - Date.parse(options.since), 180 * DAY);
      await beforeGit?.();
      const selected = records.filter(record => record.repository === repository.id);
      return { repository, revision: "a".repeat(40), ref: `refs/remotes/origin/${repository.defaultBranch}`, shallow: false, partial: false, complete: true, linesComplete: selected.every(record => record.additions !== null && record.deletions !== null), records: selected, error: null };
    },
  };
  return {
    dependencies, calls,
    setRecords: (value: ActivityRecord[]) => { records = value; },
    delayGit: (value: () => Promise<void>) => { beforeGit = value; },
  };
}
async function installation(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "bigboard-core-"));
  const data = fixtures();
  const stores: BoardStore[] = [];
  const open = () => { const store = new BoardStore(directory, data.dependencies); stores.push(store); return store; };
  t.after(async () => { stores.forEach(store => store.close()); await rm(directory, { recursive: true, force: true }); });
  return { directory, data, open, store: open() };
}

test("empty or relative XDG values use the standard state location", () => {
  const base = process.env.XDG_STATE_HOME, override = process.env.BIGBOARD_STATE_DIR;
  try {
    process.env.BIGBOARD_STATE_DIR = "";
    for (const value of ["", "relative"]) {
      process.env.XDG_STATE_HOME = value;
      assert.equal(new BoardStore().directory, join(homedir(), ".local", "state", "bigboard-mcp-app"));
    }
  } finally {
    if (base === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = base;
    if (override === undefined) delete process.env.BIGBOARD_STATE_DIR; else process.env.BIGBOARD_STATE_DIR = override;
  }
});

test("source settings use independent revisions and reads or viewing filters never collect", async (t) => {
  const { store, data, open } = await installation(t);
  const board = await store.open();
  assert.equal(board.collectedAt, null);
  assert.equal(board.configuration.needsRefresh, true);
  assert.equal(board.coverage.complete, false);
  await assert.rejects(store.refresh(), code("sources_required"));
  const configured = await store.configure(undefined, true, 0);
  assert.equal(configured.repositories.length, 2);
  assert.equal(data.calls.native, 1);
  await assert.rejects(open().configure([repos[0].path], false, 0), code("configuration_conflict"));
  const changed = await store.update(board.boardId, board.revision, { repository: repos[0].id, compare: true });
  await store.read(changed.boardId);
  assert.equal(data.calls.git, 0);
  assert.equal(store.sources().repositories.length, 2);
  await assert.rejects(store.update(changed.boardId, changed.revision, { repository: "example/missing" }), code("repository_not_configured"));
  await assert.rejects(store.configure([], true, configured.revision), code("invalid_sources"));
});

test("refresh supplies real records, exact half-open dates, comparison, and independent repository filters", async (t) => {
  const { store, data } = await installation(t);
  const boundary = new Date(NOW.getTime() - 7 * DAY).toISOString();
  data.setRecords([commit(repos[0].id, 1, boundary), commit(repos[0].id, 2, new Date(Date.parse(boundary) - 1).toISOString()), commit(repos[0].id, 3, NOW.toISOString())]);
  await store.configure([repos[0].path], false, 0);
  const opened = await store.open();
  await store.refresh();
  const board = await store.update(opened.boardId, opened.revision, { compare: true });
  assert.equal(board.scope.since, boundary);
  assert.equal(board.scope.until, NOW.toISOString());
  assert.equal(board.coverage.source, "git");
  assert.equal(board.coverage.complete, true);
  assert.equal(board.totals.commits, 1);
  assert.equal(board.totals.previousCommits, 1);
  const evidence = await store.evidence(board.boardId, board.snapshotId, board.buckets[0].start);
  assert.equal(evidence.records.length, 1);
  assert.equal(evidence.records[0].timestamp, boundary);
});

test("refresh invalidates old selection snapshots while filters remain independent", async (t) => {
  const { store, data } = await installation(t);
  await store.configure(undefined, true, 0);
  await store.refresh();
  const first = await store.open(), second = await store.open();
  const changed = await store.update(first.boardId, first.revision, { repository: repos[0].id, days: 14, compare: true });
  assert.deepEqual((await store.read(second.boardId)).query, second.query);
  const calls = { ...data.calls };
  await store.read(first.boardId);
  await store.evidence(first.boardId, changed.snapshotId);
  assert.deepEqual(data.calls, calls);
  assert.equal(changed.totals.commits, 14);
  assert.equal(changed.totals.previousCommits, 14);
  await store.refresh();
  const latest = await store.read(first.boardId);
  assert.equal(latest.revision, changed.revision);
  assert.notEqual(latest.snapshotId, changed.snapshotId);
  await assert.rejects(store.evidence(first.boardId, changed.snapshotId), code("stale_snapshot"));
});

test("restarted stores preserve Git evidence, snapshots and board queries", async (t) => {
  const { store, open } = await installation(t);
  await store.configure(undefined, true, 0);
  await store.refresh();
  const initial = await store.open();
  const changed = await store.update(initial.boardId, initial.revision, { repository: repos[0].id, days: 14 });
  store.close();
  const restarted = open();
  const recovered = await restarted.open(initial.boardId);
  assert.deepEqual(recovered.query, changed.query);
  assert.equal(recovered.revision, changed.revision);
  assert.equal(recovered.totals.commits, changed.totals.commits);
  assert.equal(recovered.snapshotId, changed.snapshotId);
  assert.equal(recovered.configuration.needsRefresh, false);
  assert.deepEqual(recovered.coverage, changed.coverage);
});

test("unknown line evidence remains a lower bound with explicit coverage gaps", async (t) => {
  const { store, data } = await installation(t);
  data.setRecords([{ ...commit(repos[0].id, 1, "2026-11-16T12:00:00.000Z"), additions: null, deletions: null, files: [] }]);
  await store.configure([repos[0].path], false, 0);
  await store.refresh();
  const board = await store.open();
  assert.equal(board.totals.commits, 1);
  assert.equal(board.totals.unknownLineCommits, 1);
  assert.equal(board.totals.additions, 0);
  assert.equal(board.coverage.complete, false);
  assert.equal(board.coverage.repositories[0].linesComplete, false);
});

test("a configuration change rejects an in-flight old refresh", async (t) => {
  const { store, data } = await installation(t);
  const configuration = await store.configure([repos[0].path], false, 0);
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { started = resolve; });
  data.delayGit(async () => { started(); await waiting; });
  const refresh = store.refresh();
  await entered;
  await assert.rejects(store.refresh(), code("refresh_in_progress"));
  await store.configure([repos[1].path], false, configuration.revision);
  release();
  await assert.rejects(refresh, code("refresh_superseded"));
  const board = await store.open();
  assert.equal(board.collectedAt, null);
  assert.deepEqual(board.configuration.repositories, [repos[1].id]);
});

test("paged evidence is complete, stable, and scoped to its snapshot", async (t) => {
  const { store, data } = await installation(t);
  data.setRecords(Array.from({ length: 123 }, (_, index) => commit(repos[0].id, index, new Date(NOW.getTime() - 3_600_000 - index * 1000).toISOString())));
  await store.configure([repos[0].path], false, 0);
  await store.refresh();
  const board = await store.open();
  const records: string[] = [];
  const preview = await store.evidence(board.boardId, board.snapshotId);
  assert.ok(preview.nextCursor);
  const selected = board.buckets.at(-1)!;
  await assert.rejects(store.evidence(board.boardId, board.snapshotId, selected.start, preview.nextCursor), code("invalid_cursor"));
  const contributors = await store.people(board.boardId, board.snapshotId);
  await assert.rejects(store.evidence(board.boardId, board.snapshotId, undefined, preview.nextCursor, contributors.people[0].id), code("invalid_cursor"));
  let cursor: string | undefined;
  do {
    const page = await store.evidence(board.boardId, board.snapshotId, undefined, cursor);
    assert.ok(page.records.length <= 25);
    records.push(...page.records.map(record => record.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  assert.equal(records.length, 123);
  assert.equal(new Set(records).size, 123);
  await assert.rejects(store.evidence(board.boardId, board.snapshotId, undefined, "wrong"), code("invalid_cursor"));
});

test("cancelled refresh retains Git evidence and its snapshot", async (t) => {
  const { store, data } = await installation(t);
  await store.configure([repos[0].path], false, 0);
  await store.refresh();
  const initial = await store.open();
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { started = resolve; });
  data.delayGit(async () => { started(); await waiting; });
  const controller = new AbortController();
  const pending = store.refresh(controller.signal);
  await entered;
  controller.abort();
  release();
  await assert.rejects(pending, code("refresh_cancelled"));
  const retained = await store.read(initial.boardId);
  assert.equal(retained.snapshotId, initial.snapshotId);
  assert.equal(retained.collectedAt, initial.collectedAt);
  assert.deepEqual(retained.query, initial.query);
  assert.equal(retained.totals.commits, initial.totals.commits);
  assert.equal(retained.totals.additions, initial.totals.additions);
  assert.equal(retained.totals.deletions, initial.totals.deletions);
});

test("old demo boards migrate to real source scope without recreating fixture evidence", async (t) => {
  const { store, directory } = await installation(t);
  const original = await store.open();
  const database = new DatabaseSync(join(directory, "boards.sqlite"));
  try {
    const saved = { version: 1, boardId: original.boardId, revision: original.revision, updatedAt: original.updatedAt, query: { days: 7, repository: "sample/api", compare: false } };
    database.prepare("UPDATE boards SET state=? WHERE id=?").run(JSON.stringify(saved), original.boardId);
  } finally { database.close(); }
  const migrated = await store.read(original.boardId);
  assert.equal(migrated.revision, original.revision + 1);
  assert.equal(migrated.query.repository, "all");
  assert.equal(migrated.coverage.source, "git");
  assert.equal(migrated.totals.commits, 0);
  assert.equal(migrated.collectedAt, null);
});

test("independent SQLite stores enforce board CAS and reset removed repository filters", async (t) => {
  const { store, open } = await installation(t);
  await store.configure(undefined, true, 0);
  const initial = await store.open();
  const another = open();
  const results = await Promise.allSettled([
    store.update(initial.boardId, initial.revision, { repository: repos[0].id }),
    another.update(initial.boardId, initial.revision, { repository: repos[1].id }),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
  const current = await store.read(initial.boardId);
  await store.configure([], false, store.sources().revision);
  const removed = await store.read(initial.boardId);
  assert.equal(removed.query.repository, "all");
  assert.equal(removed.revision, current.revision + 1);
});

test("People groups commits by mailmapped email within the date and repository scope", async t => {
  const { store, data } = await installation(t);
  const since = new Date(NOW.getTime() - 7 * DAY).toISOString();
  data.setRecords([
    { ...commit(repos[0].id, 1, since), contributor: "Same Name", email: "first@example.invalid" },
    { ...commit(repos[1].id, 2, "2026-11-16T10:00:00.000Z"), contributor: "New Name", email: "first@example.invalid", additions: null, deletions: null },
    { ...commit(repos[0].id, 3, "2026-11-16T09:00:00.000Z"), contributor: "Same Name", email: "other@example.invalid" },
    { ...commit(repos[0].id, 4, new Date(Date.parse(since) - 1).toISOString()), email: "prior@example.invalid" },
    { ...commit(repos[0].id, 5, NOW.toISOString()), email: "future@example.invalid" },
    { ...commit(repos[0].id, 6, "2026-11-15T09:00:00.000Z"), contributor: "Same Name", email: "" },
    { ...commit(repos[0].id, 7, "2026-11-14T09:00:00.000Z"), contributor: "Same Name", email: "" },
  ]);
  await store.configure(undefined, true, 0);
  await store.refresh();
  const board = await store.open();
  const git = await store.people(board.boardId, board.snapshotId);
  assert.equal(git.totalPeople, 4);
  const first = git.people.find(person => person.identity === "first@example.invalid")!;
  assert.equal(first.name, "New Name");
  assert.equal(first.commits, 2);
  assert.equal(first.additions, 10);
  assert.equal(first.deletions, 2);
  assert.equal(first.unknownLineCommits, 1);
  assert.deepEqual(first.repositories, [repos[1].id, repos[0].id]);
  assert.equal(git.people.filter(person => person.identity === "Email unavailable").length, 2);
  const commits = await store.evidence(board.boardId, board.snapshotId, undefined, undefined, first.id);
  assert.equal(commits.selectedPersonId, first.id);
  assert.equal(commits.records.length, 2);
  assert.ok(commits.records.every(record => record.email === first.identity));
  await assert.rejects(store.evidence(board.boardId, board.snapshotId, undefined, undefined, "git:unavailable"), code("selection_not_found"));
  const narrowed = await store.update(board.boardId, board.revision, { repository: repos[0].id });
  const narrowedGit = await store.people(narrowed.boardId, narrowed.snapshotId);
  assert.equal(narrowedGit.people.find(person => person.id === first.id)?.commits, 1);
});

test("People pages after aggregation and binds cursors to the endpoint and snapshot", async t => {
  const { store, data, open } = await installation(t);
  data.setRecords(Array.from({ length: 31 }, (_, index) => ({ ...commit(repos[0].id, index, "2026-11-16T10:00:00.000Z"), email: `contributor-${String(index).padStart(2, "0")}@example.invalid` })));
  await store.configure([repos[0].path], false, 0);
  await store.refresh();
  const board = await store.open();
  const first = await store.people(board.boardId, board.snapshotId);
  assert.equal(first.totalPeople, 31);
  assert.equal(first.people.length, 25);
  assert.ok(first.nextCursor);
  const second = await store.people(board.boardId, board.snapshotId, first.nextCursor);
  assert.equal(second.people.length, 6);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.people, ...second.people].map(person => person.id)).size, 31);

  const restarted = open();
  const cached = await restarted.read(board.boardId);
  assert.equal((await restarted.people(cached.boardId, cached.snapshotId)).totalPeople, 31);
  await assert.rejects(restarted.evidence(cached.boardId, cached.snapshotId, undefined, first.nextCursor), code("invalid_cursor"));
  await store.refresh();
  await assert.rejects(store.people(board.boardId, board.snapshotId, first.nextCursor), code("stale_snapshot"));
});

test("refresh progress is shared across stores without changing an in-flight evidence snapshot", async t => {
  const { store, data, open } = await installation(t);
  await store.configure(undefined, true, 0);
  const gates = repos.map(() => deferred());
  const collectGit = data.dependencies.collectGitHistory;
  data.dependencies.collectGitHistory = async (repository, options) => {
    await gates[repos.findIndex(repo => repo.id === repository.id)].promise;
    return collectGit(repository, options);
  };
  const active = open(), reader = open();
  const board = await active.open();
  const notifications: RefreshProgress[] = [];
  const pending = active.refresh(undefined, progress => {
    notifications.push(structuredClone(progress));
    progress.git.completedRepositories = 999;
    throw new Error("Synthetic observer failure");
  });

  t.after(() => { gates.forEach(gate => gate.resolve()); });
  const initial = await reader.read(board.boardId);
  assert.equal(initial.refresh?.status, "running");
  assert.equal(initial.refresh?.git.completedRepositories, 0);
  assert.equal(initial.collectedAt, null);
  gates[0].resolve();
  await new Promise(resolve => setImmediate(resolve));
  const advancing = await reader.read(board.boardId);
  assert.equal(advancing.snapshotId, initial.snapshotId);
  assert.equal(advancing.refresh?.git.completedRepositories, 1);
  assert.deepEqual(await reader.read(board.boardId, initial.snapshotId), {
    unchanged: true, snapshotId: initial.snapshotId, refresh: advancing.refresh,
  });
  gates[1].resolve();
  await pending;
  const finished = await active.read(board.boardId);
  assert.notEqual(finished.snapshotId, initial.snapshotId);
  assert.deepEqual(await reader.read(board.boardId, initial.snapshotId), finished);
  assert.equal(finished.refresh?.status, "complete");
  assert.deepEqual(finished.refresh?.git, { completedRepositories: 2, totalRepositories: 2 });
  assert.equal(finished.refresh?.finishedAt, NOW.toISOString());
  assert.equal((await reader.read(board.boardId)).refresh?.id, finished.refresh?.id);
  assert.equal(notifications[0].status, "running");
  assert.equal(notifications.at(-1)?.status, "complete");
  for (let index = 1; index < notifications.length; index += 1) {
    assert.ok(notifications[index].git.completedRepositories >= notifications[index - 1].git.completedRepositories);
  }
});

test("superseded refresh callbacks cannot replace newer progress or source settings", async t => {
  const { store, data, open } = await installation(t);
  const configuration = await store.configure([repos[0].path], false, 0);
  const board = await store.open();
  const entered = deferred(), gate = deferred();
  data.delayGit(async () => { entered.resolve(); await gate.promise; });
  const rejected = assert.rejects(store.refresh(), code("refresh_superseded"));
  t.after(() => gate.resolve());
  await entered.promise;
  const firstId = (await store.read(board.boardId)).refresh!.id;
  data.delayGit(async () => {});
  const another = open();
  await another.refresh();
  const current = await another.read(board.boardId);
  assert.notEqual(current.refresh?.id, firstId);
  assert.equal(current.refresh?.status, "complete");
  gate.resolve();
  await rejected;
  assert.deepEqual((await another.read(board.boardId)).refresh, current.refresh);
  await another.configure([repos[1].path], false, configuration.revision);
  assert.equal((await another.read(board.boardId)).refresh, null);
});

test("cancelled and abandoned refreshes expose terminal progress without replacing collected evidence", async t => {
  const { store, data, open } = await installation(t);
  await store.configure([repos[0].path], false, 0);
  await store.refresh();
  const board = await store.open();
  const entered = deferred(), gate = deferred();
  data.delayGit(async () => { entered.resolve(); await gate.promise; });
  const abort = new AbortController();
  const rejected = assert.rejects(store.refresh(abort.signal), code("refresh_cancelled"));
  t.after(() => gate.resolve());
  await entered.promise;
  const reader = open();
  const running = await reader.read(board.boardId);
  assert.equal(running.refresh?.status, "running");
  const advancedClock = new BoardStore(store.directory, { ...data.dependencies, now: () => new Date(NOW.getTime() + 180_000) });
  t.after(() => advancedClock.close());
  const abandoned = await advancedClock.read(board.boardId);
  assert.equal(abandoned.refresh?.status, "failed");
  assert.match(abandoned.refresh!.message, /interrupted|time limit/);
  assert.equal(abandoned.snapshotId, running.snapshotId);
  assert.equal((await reader.read(board.boardId)).refresh?.status, "running");
  abort.abort();
  gate.resolve();
  await rejected;
  const cancelled = await reader.read(board.boardId);
  assert.equal(cancelled.refresh?.status, "cancelled");
  assert.equal(cancelled.refresh?.finishedAt, NOW.toISOString());
  assert.equal(cancelled.collectedAt, board.collectedAt);
  assert.equal(cancelled.totals.commits, board.totals.commits);
});

test("unchanged polls skip the saved collection and detect cross-store filter and source edits", async t => {
  const { store, open, directory } = await installation(t);
  const reader = open();
  const initial = await store.open();
  await store.configure(undefined, true, 0);
  const configured = await store.read(initial.boardId);
  assert.deepEqual(await reader.read(initial.boardId, initial.snapshotId), configured);
  const edited = await store.update(initial.boardId, initial.revision, { days: 14 });
  assert.deepEqual(await reader.read(initial.boardId, configured.snapshotId), edited);
  const db = new DatabaseSync(join(directory, "boards.sqlite"));
  try {
    db.prepare("UPDATE workspace SET collection=? WHERE id=1").run("invalid fixture");
    assert.deepEqual(await reader.read(initial.boardId, edited.snapshotId), {
      unchanged: true, snapshotId: edited.snapshotId, refresh: null,
    });
    await assert.rejects(reader.read(initial.boardId), code("collection_unreadable"));
  } finally { db.close(); }
});

test("existing mixed collections expose their Git evidence with bounded file lists", async t => {
  const { store, data, directory, open } = await installation(t);
  const files = Array.from({ length: 30 }, (_, i) => ({ path: `path-${i}`, additions: 1, deletions: 0 }));
  data.setRecords([
    { ...commit(repos[0].id, 1, "2026-11-16T10:00:00.000Z"), files },
    { ...commit(repos[0].id, 2, "2026-11-16T09:00:00.000Z"), files: files.slice(0, 25), filesTruncated: true },
  ]);
  await store.configure(undefined, true, 0);
  await store.refresh();
  const board = await store.open();
  const db = new DatabaseSync(join(directory, "boards.sqlite"));
  try {
    db.exec("UPDATE workspace SET collection=json_set(collection, '$.github', json_object('pullRequests',json_array(),'account',json_object('login','fixture-user')))");
    db.exec("UPDATE refresh_progress SET state=json_set(state, '$.github', json_object('requests',1))");
  } finally { db.close(); }
  const reader = open();
  const recovered = await reader.read(board.boardId);
  assert.equal(recovered.refresh, null);
  assert.equal(recovered.configuration.needsRefresh, false);
  const result = await reader.evidence(board.boardId, recovered.snapshotId);
  assert.deepEqual(result.records.map(record => [record.files.length, record.filesTruncated]), [[25, true], [25, true]]);
  assert.equal("pullRequests" in result, false);
  assert.equal("account" in recovered, false);
});

test("periods use hourly, daily and weekly intervals that cover the window without gaps", async t => {
  const { store } = await installation(t);
  await store.configure(repos.map(repo => repo.path), false);
  await store.refresh();
  let board = await store.open();
  for (const [days, interval, count] of [[1, "hour", 24], [7, "day", 7], [14, "day", 14], [30, "day", 30], [90, "week", 13]] as const) {
    board = await store.update(board.boardId, board.revision, { days, compare: true });
    assert.equal(board.interval, interval);
    assert.equal(board.buckets.length, count);
    assert.equal(board.buckets[0].start, board.scope.since);
    assert.equal(board.buckets.at(-1)!.end, board.scope.until);
    for (let index = 1; index < count; index += 1) assert.equal(board.buckets[index].start, board.buckets[index - 1].end);
    assert.equal(board.buckets.reduce((sum, bucket) => sum + bucket.commits, 0), board.totals.commits);
    assert.equal(board.buckets.reduce((sum, bucket) => sum + bucket.previousCommits!, 0), board.totals.previousCommits);
    assert.equal(board.historyStart, null);
    assert.equal(board.configuration.needsRefresh, false);
    assert.ok(board.buckets.reduce((sum, bucket) => sum + bucket.recordIds.length, 0) <= 420);
  }
  await assert.rejects(store.update(board.boardId, board.revision, { days: 2 as never }), code("invalid_query"));
});

test("history collected for a shorter window is reported instead of shown as zero activity", async t => {
  const { store, directory } = await installation(t);
  await store.configure(repos.map(repo => repo.path), false);
  await store.refresh();
  const since = new Date(NOW.getTime() - 28 * DAY).toISOString();
  const database = new DatabaseSync(join(directory, "boards.sqlite"));
  const collection = JSON.parse(String(database.prepare("SELECT collection FROM workspace").get()!.collection));
  database.prepare("UPDATE workspace SET collection=?").run(JSON.stringify({ ...collection, since }));
  database.close();
  let board = await store.open();
  assert.equal(board.historyStart, null);
  board = await store.update(board.boardId, board.revision, { days: 30, compare: true });
  assert.equal(board.historyStart, since);
  assert.equal(board.coverage.complete, false);
  assert.equal(board.configuration.needsRefresh, true);
  assert.equal(board.totals.previousCommits, null);
  assert.match(board.coverage.note, /Refresh sources for the full period/);
});
