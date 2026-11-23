import { version } from "../package.json";

export const APP_VERSION = version;
export const MAX_EVIDENCE_FILES = 25;
export const PERIOD_DAYS = [1, 7, 14, 30, 90] as const;
export const COLLECTION_DAYS = 180;
export type PeriodDays = typeof PERIOD_DAYS[number];
export type BucketInterval = "hour" | "day" | "week";
export type RepositoryFilter = string;
export type BoardViewMode = "activity" | "people";

export interface BoardQuery {
  days: PeriodDays;
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

export interface PanelWorkspace {
  trimmed?: true;
  generation: number;
  configuration: { revision: number; repositories: Omit<ConfiguredRepository, "path">[] };
  collection: (Omit<CollectedWorkspace, "git"> & { git: (Omit<GitCollectionResult, "repository"> & { repository: Omit<ConfiguredRepository, "path"> })[] }) | null;
}

export interface RepositoryTotal {
  repository: string;
  commits: number;
  previousCommits: number | null;
}

export interface BoardHighlight {
  kind: "peak" | "interval-change" | "repository-change";
  commits: number;
  previousCommits: number | null;
  bucketStart: string | null;
  repository: string | null;
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
  repositories?: RepositoryTotal[];
  highlights?: BoardHighlight[];
  unsaved?: boolean;
  interval?: BucketInterval;
  historyStart?: string | null;
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
  previousCommits?: number | null;
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
  unsaved?: boolean;
  summary?: {
    commits: number;
    previousCommits: number | null;
    repositories: RepositoryTotal[];
    people: { name: string; commits: number; previousCommits: number | null }[];
    highlights: BoardHighlight[];
  };
}

export const BOARD_RESOURCE_URI = "ui://bigboard/activity.html";
