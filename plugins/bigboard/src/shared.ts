import { version } from "../package.json";

export const APP_VERSION = version;
export const MAX_EVIDENCE_FILES = 25;
export type RepositoryFilter = string;
export type BoardViewMode = "activity" | "people";

export interface BoardQuery {
  days: 7 | 14;
  repository: RepositoryFilter;
  compare: boolean;
}

export interface ConfiguredRepository {
  id: string;
  path: string;
  remote: string;
  defaultBranch: string;
}

export interface SourceConfiguration {
  revision: number;
  repositories: ConfiguredRepository[];
}

export interface FileChange {
  path: string;
  additions: number | null;
  deletions: number | null;
}

export interface ActivityRecord {
  id: string;
  repository: string;
  sha: string;
  timestamp: string;
  subject: string;
  contributor: string;
  email: string;
  additions: number | null;
  deletions: number | null;
  files: FileChange[];
  filesTruncated?: boolean;
  url: string;
}

export interface GitCollectionResult {
  repository: ConfiguredRepository;
  revision: string | null;
  ref: string;
  shallow: boolean;
  partial: boolean;
  complete: boolean;
  linesComplete: boolean;
  records: ActivityRecord[];
  error: string | null;
}

export interface CollectedWorkspace {
  id: string;
  configRevision: number;
  generatedAt: string;
  since: string;
  until: string;
  git: GitCollectionResult[];
}

export interface RepositoryCoverage {
  repository: string;
  revision: string | null;
  ref: string;
  shallow: boolean;
  partial: boolean;
  historyComplete: boolean;
  linesComplete: boolean;
  errors: string[];
}

export interface ActivityBucket {
  start: string;
  end: string;
  commits: number;
  additions: number;
  deletions: number;
  unknownLineCommits: number;
  previousCommits: number | null;
  recordIds: string[];
  recordIdsTruncated?: boolean;
}

export interface RefreshProgress {
  id: string;
  status: "running" | "complete" | "failed" | "cancelled";
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  git: { completedRepositories: number; totalRepositories: number };
  message: string;
}

export interface BoardSnapshot {
  initialView?: BoardViewMode;
  refresh?: RefreshProgress | null;
  boardId: string;
  revision: number;
  snapshotId: string;
  updatedAt: string;
  query: BoardQuery;
  scope: { since: string; until: string; timezone: string };
  coverage: { source: "git"; complete: boolean; note: string; repositories: RepositoryCoverage[] };
  configuration: { revision: number; repositories: string[]; needsRefresh: boolean };
  collectedAt: string | null;
  buckets: ActivityBucket[];
  totals: { commits: number; additions: number; deletions: number; unknownLineCommits: number; previousCommits: number | null };
}

export interface BoardUnchanged {
  unchanged: true;
  snapshotId: string;
  refresh: RefreshProgress | null;
}

export interface PersonSummary {
  id: string;
  name: string;
  identity: string;
  commits: number;
  additions: number;
  deletions: number;
  unknownLineCommits: number;
  repositories: string[];
}

export interface PeopleResult {
  boardId: string;
  revision: number;
  snapshotId: string;
  query: BoardQuery;
  scope: BoardSnapshot["scope"];
  coverage: BoardSnapshot["coverage"];
  people: PersonSummary[];
  totalPeople: number;
  nextCursor: string | null;
}

export interface EvidenceResult {
  boardId: string;
  revision: number;
  snapshotId: string;
  query: BoardQuery;
  scope: BoardSnapshot["scope"];
  coverage: BoardSnapshot["coverage"];
  bucketStart: string | null;
  records: ActivityRecord[];
  nextCursor: string | null;
  totalRecords: number;
  selectedPersonId?: string;
}

export interface SelectionContext {
  boardId: string;
  revision: number;
  snapshotId: string;
  query: BoardQuery;
  scope: BoardSnapshot["scope"];
  bucketStart: string | null;
  recordIds: string[];
  recordIdsTruncated?: boolean;
  view?: BoardViewMode;
  personId?: string | null;
}

export const BOARD_RESOURCE_URI = "ui://bigboard/activity.html";
