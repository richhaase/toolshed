import type { PullRequestRecord, PullRequestSort, SortDirection } from "./shared";

export type AttentionGroup = "awaiting_review" | "awaiting_re_review" | "respond_to_feedback" | "assigned_to_you" | "awaiting_reviewer" | "ready_to_merge" | "other_yours" | "needs_review" | "other_org";
export type QueueSort = "attention" | PullRequestSort;
export type QueueAttentionFilter = "all" | "mine" | "review";

export interface PullRequestAttention {
  group: AttentionGroup;
  label: string;
  reason: string;
  priority: number;
  incomplete: boolean;
}

export interface PullRequestWorkflow {
  reviews: Array<{ id: string; author: string; state: string; submittedAt: string; commitSha: string | null; inlineComments: number }>;
  reviewsComplete: boolean;
  lastCommitAt: string | null;
  lastAuthorResponseAt: string | null;
  responsesComplete: boolean;
  checks: "success" | "failure" | "pending" | "none" | "unknown";
  dismissals: Array<{ reviewId: string; previousState: string }>;
  dismissalsComplete: boolean;
  bot: boolean;
}

export interface QueueCollectedPullRequest extends PullRequestRecord {
  workflow?: PullRequestWorkflow;
}

export interface OrganizationPullRequestCollection {
  organization: string;
  account: { id: string; login: string } | null;
  collectedAt: string;
  pullRequests: QueueCollectedPullRequest[];
  openComplete: boolean;
  mergedComplete: boolean;
  detailsComplete: boolean;
  error: string | null;
  accessInvalidated: boolean;
  deniedRepositories?: string[];
  scopeDenied?: boolean;
  requests: number;
}

export interface PullRequestQueueQuery {
  organization: string | null;
  repository: string;
  attention: QueueAttentionFilter;
  days: 7 | 14 | 30;
}

export interface PullRequestQueueProgress {
  id: string;
  status: "running" | "complete" | "failed" | "cancelled";
  phase: "discovering" | "details" | "finished";
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  completed: number;
  total: number | null;
  requests: number;
  message: string;
}

export interface PullRequestQueueSnapshot {
  boardId: string;
  revision: number;
  snapshotId: string;
  query: PullRequestQueueQuery;
  account: { id: string; login: string } | null;
  collectedAt: string | null;
  needsRefresh: boolean;
  repositories: string[];
  refresh: PullRequestQueueProgress | null;
  coverage: { openComplete: boolean; mergedComplete: boolean; detailsComplete: boolean; note: string };
  totals: { open: number; merged: number; groups: Array<{ group: AttentionGroup; label: string; count: number }> };
}

export interface PullRequestQueueFilter {
  state?: "open" | "merged";
  sort?: QueueSort;
  direction?: SortDirection;
  pullRequestId?: string;
  cursor?: string;
}

export interface PullRequestQueueEvidence {
  coverage: PullRequestQueueSnapshot["coverage"];
  collectedAt: string | null;
  needsRefresh: boolean;
  boardId: string;
  snapshotId: string;
  query: PullRequestQueueQuery;
  account: { id: string; login: string } | null;
  pullRequests: PullRequestRecord[];
  totalPullRequests: number;
  groups: Array<{ group: AttentionGroup; label: string; count: number }>;
  nextCursor: string | null;
  state: "open" | "merged";
  sort: QueueSort;
  direction: SortDirection;
}

export interface OrganizationCollectionOptions {
  since: string;
  until: string;
  signal?: AbortSignal;
  onProgress?: (progress: { phase: "discovering" | "details"; completed: number; total: number | null; requests: number }) => void;
}
