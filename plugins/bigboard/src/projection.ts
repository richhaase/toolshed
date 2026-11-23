import { BoardError } from "./errors";
import { MAX_EVIDENCE_FILES } from "./shared";
import type { ActivityRecord, BoardHighlight, BoardQuery, BoardSnapshot, EvidenceResult, PanelWorkspace, PeopleResult, PersonSummary, RefreshProgress, RepositoryCoverage, RepositoryTotal } from "./shared";

const DAY = 86_400_000;
const PAGE_SIZE = 25;

export interface ProjectedBoard { boardId: string; revision: number; updatedAt: string; query: BoardQuery }
export interface ProjectedWorkspace extends PanelWorkspace { refresh: RefreshProgress | null }

function encode(value: unknown): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(JSON.stringify(value))) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decode(value: string): unknown {
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0))));
}

function gitPersonId(record: ActivityRecord): string {
  return `git:${encode(record.email ? ["email", record.email] : ["record", record.id])}`;
}

export function validateQuery(value: unknown): BoardQuery {
  const query = value as Partial<BoardQuery> | null;
  if (!query || (query.days !== 7 && query.days !== 14) || typeof query.repository !== "string" || !query.repository || typeof query.compare !== "boolean") {
    throw new BoardError("invalid_query", "Use days 7 or 14, a configured repository or all, and a boolean comparison setting.");
  }
  return { days: query.days, repository: query.repository, compare: query.compare };
}

export function snapshotIdFor(boardId: string, revision: number, generation: number): string {
  return `git:${boardId}:${revision}:${generation}`;
}

function page<T>(items: T[], cursor: string | undefined, selection: (string | null)[]) {
  let offset = 0;
  if (cursor !== undefined) {
    try {
      if (cursor.length > 16384 || !/^[a-zA-Z0-9_-]+$/.test(cursor)) throw new Error();
      const decoded = decode(cursor);
      if (!Array.isArray(decoded) || decoded.length !== selection.length + 1 || !selection.every((value, i) => value === decoded[i])) throw new Error();
      offset = decoded[selection.length];
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > items.length) throw new Error();
    } catch {
      throw new BoardError("invalid_cursor", "Use the nextCursor returned for this snapshot and selection.");
    }
  }
  const end = offset + PAGE_SIZE;
  return { items: items.slice(offset, end), nextCursor: end < items.length ? encode([...selection, end]) : null };
}

export function projectCoverage(repositories: PanelWorkspace["configuration"]["repositories"], collection: PanelWorkspace["collection"]): RepositoryCoverage[] {
  return repositories.map(repo => {
    const git = collection?.git.find(value => value.repository.id === repo.id);
    return {
      repository: repo.id, revision: git?.revision ?? null, ref: git?.ref ?? `refs/remotes/${repo.remote}/${repo.defaultBranch}`,
      shallow: git?.shallow ?? false, partial: git?.partial ?? false, historyComplete: git?.complete ?? false,
      linesComplete: git?.linesComplete ?? false, errors: git?.error ? [git.error] : [],
    };
  });
}

function periods(query: BoardQuery, workspace: PanelWorkspace, fallbackUntil: string) {
  const { collection, configuration } = workspace;
  const until = collection?.until ?? fallbackUntil;
  const since = new Date(Date.parse(until) - query.days * DAY).toISOString();
  const previousSince = new Date(Date.parse(since) - query.days * DAY).toISOString();
  const repositories = configuration.repositories.filter(repo => query.repository === "all" || repo.id === query.repository);
  const ids = new Set(repositories.map(repo => repo.id));
  const coverage = projectCoverage(repositories, collection);
  const records = (collection?.git ?? []).filter(value => ids.has(value.repository.id)).flatMap(value => value.records);
  const current = records.filter(record => record.timestamp >= since && record.timestamp < until);
  const priorCovered = Boolean(collection && collection.since <= previousSince && repositories.length && coverage.every(repo => repo.historyComplete));
  const previous = query.compare && priorCovered ? records.filter(record => record.timestamp >= previousSince && record.timestamp < since) : null;
  return { since, until, repositories, coverage, current, previous };
}

function repositoryTotals(current: ActivityRecord[], previous: ActivityRecord[] | null): RepositoryTotal[] {
  const totals = new Map<string, RepositoryTotal>();
  const total = (repository: string) => {
    let value = totals.get(repository);
    if (!value) { value = { repository, commits: 0, previousCommits: previous ? 0 : null }; totals.set(repository, value); }
    return value;
  };
  for (const record of current) total(record.repository).commits += 1;
  for (const record of previous ?? []) { const value = total(record.repository); value.previousCommits = (value.previousCommits ?? 0) + 1; }
  return [...totals.values()].sort((a, b) => b.commits - a.commits || (b.previousCommits ?? 0) - (a.previousCommits ?? 0) || a.repository.localeCompare(b.repository));
}

function highlights(buckets: BoardSnapshot["buckets"], repositories: RepositoryTotal[], query: BoardQuery): BoardHighlight[] {
  const result: BoardHighlight[] = [];
  const peak = buckets.reduce<BoardSnapshot["buckets"][number] | null>((best, bucket) => bucket.commits > (best?.commits ?? 0) ? bucket : best, null);
  if (peak) result.push({ kind: "peak", commits: peak.commits, previousCommits: peak.previousCommits, bucketStart: peak.start, repository: null });
  const compared = buckets.filter(bucket => bucket.previousCommits !== null);
  const change = (bucket: BoardSnapshot["buckets"][number]) => bucket.commits - (bucket.previousCommits ?? 0);
  const shift = compared.reduce<BoardSnapshot["buckets"][number] | null>((best, bucket) => change(bucket) !== 0 && Math.abs(change(bucket)) > (best ? Math.abs(change(best)) : 0) ? bucket : best, null);
  if (shift && shift.start !== peak?.start) result.push({ kind: "interval-change", commits: shift.commits, previousCommits: shift.previousCommits, bucketStart: shift.start, repository: null });
  if (query.repository === "all") {
    const moved = repositories.filter(value => value.previousCommits !== null && value.previousCommits !== value.commits)
      .sort((a, b) => Math.abs(b.commits - b.previousCommits!) - Math.abs(a.commits - a.previousCommits!) || a.repository.localeCompare(b.repository))[0];
    if (moved) result.push({ kind: "repository-change", commits: moved.commits, previousCommits: moved.previousCommits, bucketStart: null, repository: moved.repository });
  }
  return result;
}

export function projectSnapshot(board: ProjectedBoard, workspace: ProjectedWorkspace): BoardSnapshot {
  const { configuration, collection } = workspace;
  const { since, until, repositories, coverage, current, previous } = periods(board.query, workspace, board.updatedAt);
  const complete = Boolean(collection && repositories.length && coverage.every(repo => repo.historyComplete && repo.linesComplete));
  const buckets = Array.from({ length: board.query.days }, (_, index) => {
    const start = new Date(Date.parse(since) + index * DAY).toISOString();
    const end = new Date(Date.parse(start) + DAY).toISOString();
    const selected = current.filter(record => record.timestamp >= start && record.timestamp < end);
    const priorStart = new Date(Date.parse(start) - board.query.days * DAY).toISOString();
    const priorEnd = new Date(Date.parse(end) - board.query.days * DAY).toISOString();
    return {
      start, end, commits: selected.length,
      additions: selected.reduce((sum, record) => sum + (record.additions ?? 0), 0),
      deletions: selected.reduce((sum, record) => sum + (record.deletions ?? 0), 0),
      unknownLineCommits: selected.filter(record => record.additions === null || record.deletions === null).length,
      previousCommits: previous?.filter(record => record.timestamp >= priorStart && record.timestamp < priorEnd).length ?? null,
      recordIds: selected.slice(0, 30).map(record => record.id), recordIdsTruncated: selected.length > 30,
    };
  });
  const note = !configuration.repositories.length ? "Configure local clone paths or import the native BigBoard selection, then refresh sources."
    : !collection ? "Refresh sources to collect Git history."
    : `Git activity uses author dates from local remote-tracking default branches. ${complete ? "Coverage is complete." : "Coverage is incomplete. Reported counts may be lower bounds."}`;
  const totals = repositoryTotals(current, previous);
  return {
    refresh: workspace.refresh, boardId: board.boardId, revision: board.revision,
    snapshotId: snapshotIdFor(board.boardId, board.revision, workspace.generation),
    updatedAt: board.updatedAt, query: board.query, scope: { since, until, timezone: "UTC" },
    coverage: { source: "git", complete, note, repositories: coverage },
    configuration: { revision: configuration.revision, repositories: configuration.repositories.map(repo => repo.id), needsRefresh: !collection || collection.configRevision !== configuration.revision },
    collectedAt: collection?.generatedAt ?? null, buckets, repositories: totals, highlights: highlights(buckets, totals, board.query),
    totals: {
      commits: current.length, additions: current.reduce((sum, r) => sum + (r.additions ?? 0), 0),
      deletions: current.reduce((sum, r) => sum + (r.deletions ?? 0), 0),
      unknownLineCommits: current.filter(r => r.additions === null || r.deletions === null).length,
      previousCommits: previous?.length ?? null,
    },
  };
}

function selection(board: BoardSnapshot, workspace: PanelWorkspace, snapshotId: string, bucketStart?: string) {
  if (board.snapshotId !== snapshotId) throw new BoardError("stale_snapshot", "The selected evidence changed. Read the board and select the current snapshot.");
  const bucket = bucketStart === undefined ? undefined : board.buckets.find(value => value.start === bucketStart);
  if (bucketStart !== undefined && !bucket) throw new BoardError("invalid_selection", "The selected bucket is outside this board's scope.");
  const since = bucket?.start ?? board.scope.since;
  const until = bucket?.end ?? board.scope.until;
  const { current } = periods(board.query, workspace, board.scope.until);
  return current.filter(record => record.timestamp >= since && record.timestamp < until)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp) || a.id.localeCompare(b.id));
}

export function projectPeople(board: BoardSnapshot, workspace: PanelWorkspace, snapshotId: string, cursor?: string): PeopleResult {
  const people = new Map<string, PersonSummary>();
  for (const record of selection(board, workspace, snapshotId)) {
    const id = gitPersonId(record);
    let person = people.get(id);
    if (!person) {
      person = { id, name: record.contributor, identity: record.email || "Email unavailable", commits: 0, previousCommits: null, additions: 0, deletions: 0, unknownLineCommits: 0, repositories: [] };
      people.set(id, person);
    }
    if (!person.repositories.includes(record.repository)) person.repositories.push(record.repository);
    person.commits++;
    person.additions += record.additions ?? 0;
    person.deletions += record.deletions ?? 0;
    person.unknownLineCommits += Number(record.additions === null || record.deletions === null);
  }
  const { previous } = periods(board.query, workspace, board.scope.until);
  if (previous) {
    const earlier = new Map<string, number>();
    for (const record of previous) { const id = gitPersonId(record); earlier.set(id, (earlier.get(id) ?? 0) + 1); }
    for (const person of people.values()) person.previousCommits = earlier.get(person.id) ?? 0;
  }
  const sorted = [...people.values()].sort((a, b) => b.commits - a.commits || a.identity.localeCompare(b.identity) || a.id.localeCompare(b.id));
  const result = page(sorted, cursor, ["people", snapshotId]);
  for (const person of result.items) person.repositories.sort();
  return {
    boardId: board.boardId, revision: board.revision, snapshotId, query: board.query, scope: board.scope, coverage: board.coverage,
    people: result.items, totalPeople: sorted.length, nextCursor: result.nextCursor,
  };
}

export function projectEvidence(board: BoardSnapshot, workspace: PanelWorkspace, snapshotId: string, bucketStart?: string, cursor?: string, personId?: string): EvidenceResult {
  const selected = selection(board, workspace, snapshotId, bucketStart);
  const records = personId === undefined ? selected : selected.filter(record => gitPersonId(record) === personId);
  if (personId !== undefined && records.length === 0) throw new BoardError("selection_not_found", "The selected contributor has no evidence in this scope. Refresh the selection before discussing it.");
  const result = page(records, cursor, ["evidence", snapshotId, bucketStart ?? null, personId ?? null]);
  return {
    boardId: board.boardId, revision: board.revision, snapshotId, query: board.query, scope: board.scope, coverage: board.coverage,
    bucketStart: bucketStart ?? null, selectedPersonId: personId, totalRecords: records.length, nextCursor: result.nextCursor,
    records: result.items.map(record => ({
      ...record, files: record.files.slice(0, MAX_EVIDENCE_FILES),
      filesTruncated: record.filesTruncated === true || record.files.length > MAX_EVIDENCE_FILES,
    })),
  };
}
