import assert from "node:assert/strict";
import test from "node:test";
import { attentionGroupCounts, classifyPullRequest } from "../src/pr-attention";
import type { PullRequestWorkflow, QueueCollectedPullRequest } from "../src/pr-queue-types";
import type { PullRequestReview } from "../src/shared";

function record(changes: Partial<QueueCollectedPullRequest> = {}, review: Partial<PullRequestReview> = {}, workflow: Partial<PullRequestWorkflow> = {}): QueueCollectedPullRequest {
  return { id: "example/alpha#1", repository: "example/alpha", number: 1, title: "Synthetic change", url: "https://github.com/example/alpha/pull/1", author: "fixture-author", state: "open", draft: false, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-11-04T00:00:00.000Z", mergedAt: null, baseBranch: "main", headSha: "a".repeat(40), review: { decision: "none", requestedReviewers: [], requestedTeams: [], assignees: [], reviewRequestsComplete: true, assigneesComplete: true, ...review }, workflow: { reviews: [], reviewsComplete: true, lastCommitAt: "2026-11-01T00:00:00.000Z", lastAuthorResponseAt: null, responsesComplete: true, checks: "none", dismissals: [], dismissalsComplete: true, bot: false, ...workflow }, ...changes };
}

function review(state: string, author = "fixture-reviewer", at = "2026-11-02T00:00:00.000Z", commitSha: string | null = "a".repeat(40), inlineComments = 1) {
  return { id: `${author}-${state}-${at}`, author, state, submittedAt: at, commitSha, inlineComments };
}

test("direct requests distinguish first review, repeat review, and incomplete history without inferring team membership", () => {
  assert.equal(classifyPullRequest(record({}, { requestedReviewers: ["FIXTURE-VIEWER"] }), "fixture-viewer").group, "awaiting_review");
  assert.equal(classifyPullRequest(record({}, { requestedReviewers: ["fixture-viewer"] }, { reviews: [review("APPROVED", "fixture-viewer")] }), "fixture-viewer").group, "awaiting_re_review");
  const incomplete = classifyPullRequest(record({}, { requestedReviewers: ["fixture-viewer"] }, { reviewsComplete: false }), "fixture-viewer");
  assert.equal(incomplete.group, "awaiting_review");
  assert.equal(incomplete.incomplete, true);
  assert.match(incomplete.reason, /earlier review history is incomplete/);
  assert.equal(classifyPullRequest(record({}, { requestedTeams: ["example/maintainers"] }), "fixture-viewer").group, "needs_review");
});

test("dismissed reviews retain provenance and stale commented reviews request re-review while stale approvals alone do not", () => {
  const dismissed = review("DISMISSED", "fixture-viewer");
  const base = record({}, {}, { reviews: [dismissed], dismissals: [{ reviewId: dismissed.id, previousState: "APPROVED" }] });
  assert.equal(classifyPullRequest(base, "fixture-viewer").group, "awaiting_re_review");
  assert.match(classifyPullRequest(base, "fixture-viewer").reason, /approval was dismissed/);
  base.workflow!.dismissals[0].previousState = "COMMENTED";
  assert.doesNotMatch(classifyPullRequest(base, "fixture-viewer").reason, /approval/);
  assert.equal(classifyPullRequest(record({}, {}, { reviews: [review("COMMENTED", "fixture-viewer", undefined, "b".repeat(40))] }), "fixture-viewer").group, "awaiting_re_review");
  assert.equal(classifyPullRequest(record({}, {}, { reviews: [review("APPROVED", "fixture-viewer", undefined, "b".repeat(40))] }), "fixture-viewer").group, "other_org");
});

test("author feedback follows the latest author commit or conversation reply and incomplete replies remain unknown", () => {
  const feedback = review("CHANGES_REQUESTED");
  const own = { author: "fixture-viewer" };
  assert.equal(classifyPullRequest(record(own, { decision: "changes_requested" }, { reviews: [feedback] }), "fixture-viewer").group, "respond_to_feedback");
  assert.equal(classifyPullRequest(record(own, { decision: "changes_requested" }, { reviews: [feedback], lastAuthorResponseAt: "2026-11-03T00:00:00.000Z" }), "fixture-viewer").group, "awaiting_reviewer");
  const incomplete = classifyPullRequest(record(own, { decision: "changes_requested" }, { reviews: [feedback], responsesComplete: false }), "fixture-viewer");
  assert.equal(incomplete.group, "other_yours");
  assert.equal(incomplete.incomplete, true);
  assert.equal(classifyPullRequest(record(own, { decision: "changes_requested" }, { reviews: [feedback], lastCommitAt: null }), "fixture-viewer").group, "other_yours");
});

test("aggregate approval outranks later comments and current-head approval plus reported checks governs ready-to-merge", () => {
  const reviews = [review("APPROVED"), review("COMMENTED", "fixture-reviewer", "2026-11-03T00:00:00.000Z")];
  const own = { author: "fixture-viewer" };
  assert.equal(classifyPullRequest(record(own, { decision: "approved" }, { reviews, checks: "success" }), "fixture-viewer").group, "ready_to_merge");
  assert.equal(classifyPullRequest(record(own, { decision: "approved" }, { reviews, checks: "failure" }), "fixture-viewer").group, "respond_to_feedback");
  assert.equal(classifyPullRequest(record(own, { decision: "approved" }, { reviews, checks: "pending" }), "fixture-viewer").group, "respond_to_feedback");
  assert.equal(classifyPullRequest(record(own, { decision: "approved" }, { reviews, checks: "unknown" }), "fixture-viewer").group, "other_yours");
  assert.equal(classifyPullRequest(record(own, { decision: "approved" }, { reviews: [review("APPROVED", undefined, undefined, "b".repeat(40))] }), "fixture-viewer").group, "awaiting_reviewer");
});

test("partial approvals and summary-only bot comments do not misclassify authored waiting work", () => {
  const own = { author: "fixture-viewer" };
  const partial = classifyPullRequest(record(own, { decision: "review_required" }, { reviews: [review("APPROVED")] }), "fixture-viewer");
  assert.equal(partial.group, "awaiting_reviewer");
  assert.match(partial.reason, /1 current approval; more required/);
  assert.notEqual(classifyPullRequest(record(own, {}, { reviews: [review("COMMENTED", "fixture-bot[bot]", undefined, undefined, 0)] }), "fixture-viewer").group, "respond_to_feedback");
  assert.equal(classifyPullRequest(record(own, {}, { reviews: [review("COMMENTED", "fixture-bot[bot]")] }), "fixture-viewer").group, "respond_to_feedback");
});

test("drafts, unknown authored states, assignments, and the whole organization remain represented exactly once", () => {
  const candidates = [record({ author: "fixture-viewer", draft: true }), record({ id: "example/alpha#2", number: 2, author: "fixture-viewer", workflow: undefined }), record({ id: "example/alpha#3", number: 3 }, { assignees: ["fixture-viewer"] }), record({ id: "example/alpha#4", number: 4 }), record({ id: "example/alpha#5", number: 5, draft: true })];
  const classified = candidates.map(pr => ({ ...pr, attention: classifyPullRequest(pr, "fixture-viewer") }));
  assert.deepEqual(classified.map(pr => pr.attention.group), ["other_yours", "other_yours", "assigned_to_you", "needs_review", "other_org"]);
  assert.equal(attentionGroupCounts(classified).reduce((total, group) => total + group.count, 0), candidates.length);
  assert.deepEqual(attentionGroupCounts(classified).map(group => group.group), ["assigned_to_you", "other_yours", "needs_review", "other_org"]);
  assert.equal(classifyPullRequest(candidates[2], null).incomplete, true);
});
