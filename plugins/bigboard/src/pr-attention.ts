import type { AttentionGroup, PullRequestAttention, PullRequestWorkflow, QueueCollectedPullRequest } from "./pr-queue-types";
import type { PullRequestRecord } from "./shared";

export const ATTENTION_GROUPS: Array<{ group: AttentionGroup; label: string; priority: number }> = [
  { group: "awaiting_review", label: "Awaiting your review", priority: 0 },
  { group: "awaiting_re_review", label: "Awaiting your re-review", priority: 1 },
  { group: "respond_to_feedback", label: "Respond to feedback", priority: 2 },
  { group: "assigned_to_you", label: "Assigned to you", priority: 3 },
  { group: "awaiting_reviewer", label: "Awaiting reviewer", priority: 4 },
  { group: "ready_to_merge", label: "Ready to merge", priority: 5 },
  { group: "other_yours", label: "Other open PRs of yours", priority: 6 },
  { group: "needs_review", label: "Needs review across the organization", priority: 7 },
  { group: "other_org", label: "Other organization PRs", priority: 8 },
];

type Review = PullRequestWorkflow["reviews"][number];
const time = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const isBot = (login: string) => /\[bot\]$/i.test(login) || /^(copilot|copilot-pull-request-reviewer)$/i.test(login);

export function classifyPullRequest(pr: QueueCollectedPullRequest, viewer: string | null): PullRequestAttention {
  const review = pr.review;
  const workflow = pr.workflow;
  const incomplete = !viewer || !review || review.decision === "unknown" || !review.reviewRequestsComplete || !review.assigneesComplete || workflow?.checks === "unknown" ||
    pr.state === "open" && (!workflow || !workflow.reviewsComplete || !workflow.responsesComplete || !workflow.dismissalsComplete);
  const group = (name: AttentionGroup, reason: string): PullRequestAttention => ({ ...ATTENTION_GROUPS.find(value => value.group === name)!, reason, incomplete });
  if (pr.state !== "open") return group("other_org", "This pull request has merged.");
  if (!viewer) return group("other_org", "Refresh to verify the GitHub account before identifying your review queue.");
  const mine = (login: string) => login.toLowerCase() === viewer.toLowerCase();
  const authored = mine(pr.author);
  if (pr.draft) return group(authored ? "other_yours" : "other_org", "Draft; not marked ready for review.");
  const latest = new Map<string, Review>();
  for (const value of workflow?.reviews ?? []) {
    if (value.state === "PENDING" || time(value.submittedAt) === null) continue;
    const key = value.author.toLowerCase();
    if (!latest.has(key) || value.submittedAt > latest.get(key)!.submittedAt) latest.set(key, value);
  }
  const ownReview = latest.get(viewer.toLowerCase());
  const explicitlyRequested = review?.requestedReviewers.some(mine) === true;
  const stale = (value: Review) => value.commitSha ? value.commitSha.toLowerCase() !== pr.headSha.toLowerCase() :
    time(workflow?.lastCommitAt) !== null && time(value.submittedAt) !== null ? time(workflow?.lastCommitAt)! > time(value.submittedAt)! : null;
  if (!authored) {
    if (ownReview?.state === "DISMISSED") {
      const previous = workflow?.dismissals.find(value => value.reviewId === ownReview.id)?.previousState;
      const reason = previous === "APPROVED" ? "Your approval was dismissed." : previous === "CHANGES_REQUESTED" ? "Your changes-requested review was dismissed." : previous === "COMMENTED" ? "Your comment review was dismissed." : "Your review was dismissed; its previous state is unavailable.";
      return group("awaiting_re_review", reason);
    }
    if (explicitlyRequested) return ownReview ? group("awaiting_re_review", "Your review was requested again after your previous review.") :
      group("awaiting_review", workflow?.reviewsComplete ? "Your review is explicitly requested." : "Your review is requested; earlier review history is incomplete.");
    if (ownReview && ["COMMENTED", "CHANGES_REQUESTED"].includes(ownReview.state) && stale(ownReview) === true) {
      return group("awaiting_re_review", "New head commits have landed since your review.");
    }
    if (review?.assignees.some(mine)) return group("assigned_to_you", "You are assigned to this pull request; assignment alone is not a review request.");
  }
  const others = [...latest.values()].filter(value => !mine(value.author));
  const approvals = [...new Map((workflow?.reviews ?? []).filter(value => !mine(value.author) && value.state === "APPROVED" && stale(value) === false &&
    !(workflow?.reviews ?? []).some(later => later.author.toLowerCase() === value.author.toLowerCase() && later.submittedAt > value.submittedAt && ["CHANGES_REQUESTED", "DISMISSED"].includes(later.state)))
    .map(value => [value.author.toLowerCase(), value])).values()];
  if (authored) {
    if (!workflow || !review || review.decision === "unknown") return group("other_yours", "Review details are unavailable; your open PR remains in the queue.");
    const lastActivity = Math.max(time(workflow.lastCommitAt) ?? 0, time(workflow.lastAuthorResponseAt) ?? 0);
    const actionable = others.filter(value => value.state === "CHANGES_REQUESTED" || value.state === "COMMENTED" && (!isBot(value.author) || value.inlineComments > 0))
      .sort((a,b) => b.submittedAt.localeCompare(a.submittedAt))[0];
    if (review.decision !== "approved" && actionable && workflow.responsesComplete && time(workflow.lastCommitAt) !== null && time(actionable.submittedAt)! > lastActivity) {
      return group("respond_to_feedback", actionable.state === "CHANGES_REQUESTED" ? "A reviewer requested changes after your last commit or reply." : "A reviewer left feedback after your last commit or reply.");
    }
    if (approvals.length > 0 && review.decision !== "review_required" && ["failure", "pending"].includes(workflow.checks)) {
      return group("respond_to_feedback", workflow.checks === "failure" ? "The PR has a fresh approval, but checks are failing." : "The PR has a fresh approval, but checks are still pending.");
    }
    if (!incomplete && approvals.length > 0 && ["approved", "none"].includes(review.decision) && ["success", "none"].includes(workflow.checks)) {
      return group("ready_to_merge", "A current-head approval is recorded and reported checks are green or absent.");
    }
    const responded = Boolean(actionable && lastActivity > time(actionable.submittedAt)!);
    if (workflow.reviewsComplete && workflow.responsesComplete && (review.decision !== "changes_requested" || responded) &&
        (review.decision === "review_required" || others.length === 0 || others.every(value => stale(value) === true) || responded)) {
      return group("awaiting_reviewer", review.decision === "review_required" && approvals.length > 0 ? `${approvals.length} current approval${approvals.length === 1 ? "" : "s"}; more required.` : "Waiting for a fresh review or further approval.");
    }
    return group("other_yours", incomplete ? "Review evidence is incomplete; your open PR remains visible." : "Your PR is open; no specific next action is established.");
  }
  if (!ownReview && workflow?.reviewsComplete && (review?.decision === "review_required" || others.length === 0)) {
    return group("needs_review", review?.decision === "review_required" ? "GitHub reports that more review approval is required." : "No submitted reviews are recorded.");
  }
  return group("other_org", incomplete ? "Review details are incomplete; no personal action is inferred." : ownReview ? "You have already reviewed; no re-review request or new reviewed head is recorded." : "No direct action for you is recorded.");
}

export function attentionGroupCounts(records: PullRequestRecord[]): Array<{ group: AttentionGroup; label: string; count: number }> {
  return ATTENTION_GROUPS.map(({ group, label }) => ({ group, label, count: records.filter(record => record.attention?.group === group).length })).filter(value => value.count > 0);
}
