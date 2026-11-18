import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { AppBridge } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { CallToolResult, JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { JSDOM, VirtualConsole } from "jsdom";
import type { BoardSnapshot, PullRequestRecord, SelectionContext } from "../src/shared";
import type { PullRequestQueueEvidence, PullRequestQueueSnapshot, QueueSort } from "../src/pr-queue-types";

const NOW = "2026-11-17T12:00:00.000Z";
const START = "2026-11-16T12:00:00.000Z";
const BOARD = "11111111-1111-4111-8111-111111111111";

async function waitFor(predicate: () => boolean, name: string): Promise<void> {
  const until = Date.now() + 6000;
  while (!predicate()) {
    if (Date.now() > until) throw new Error(`Timed out waiting for ${name}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

function button(document: Document, text: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>("button")].find(item => item.getAttribute("aria-label") === text || item.textContent?.trim() === text);
  assert.ok(found, `Missing ${text}`);
  return found;
}

function choose(document: Document, label: string, value: string): void {
  const select = document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  assert.ok(select, `Missing ${label}`);
  select.value = value;
  select.dispatchEvent(new document.defaultView!.Event("change", { bubbles: true }));
}

function pr(organization: string, number: number, attention = false): PullRequestRecord {
  return {
    id: `${organization}/remote#${number}`, repository: `${organization}/remote`, number,
    title: attention ? "Review the API change" : "Organization work", url: `https://github.com/${organization}/remote/pull/${number}`,
    author: attention ? "fixture-contributor" : "fixture-author", state: "open", draft: false,
    createdAt: START, updatedAt: attention ? START : NOW, mergedAt: null, baseBranch: "main", headSha: String(number).padStart(40, "a"),
    review: { decision: "review_required", requestedReviewers: attention ? ["fixture-reviewer"] : [], requestedTeams: [], assignees: [], reviewRequestsComplete: true, assigneesComplete: true },
    attention: attention ? { group: "awaiting_review", label: "Awaiting your review", reason: "Your review was explicitly requested.", priority: 0, incomplete: false } : { group: "needs_review", label: "Needs review across the organization", reason: "GitHub still requires a review.", priority: 7, incomplete: false },
  };
}

class QueueWorkspace {
  revision = 1;
  generation = 1;
  organization: string | null = "example-org";
  repository = "all";
  attention: "all" | "mine" | "review" = "all";
  days: 7 | 14 | 30 = 14;
  account: PullRequestQueueSnapshot["account"] = { id: "17", login: "fixture-reviewer" };
  collected = true;
  refresh: PullRequestQueueSnapshot["refresh"] = null;
  refreshGate: Promise<void> | null = null;
  queryGate: Promise<void> | null = null;
  historyConfigured = false;
  get queue(): PullRequestQueueSnapshot {
    return { boardId: BOARD, revision: this.revision, snapshotId: `${this.organization}:${this.generation}:${this.revision}:${this.account?.id ?? "unverified"}`,
      query: { organization: this.organization, repository: this.repository, attention: this.attention, days: this.days },
      account: this.account, collectedAt: this.collected ? NOW : null, needsRefresh: !this.collected,
      repositories: this.organization ? [`${this.organization}/remote`] : [], refresh: this.refresh,
      coverage: { openComplete: true, mergedComplete: true, detailsComplete: true, note: "All accessible organization PRs checked." },
      totals: { open: 3, merged: 0, groups: [{ group: "awaiting_review", label: "Awaiting your review", count: 1 }, { group: "needs_review", label: "Needs review across the organization", count: 2 }] } };
  }
  snapshot(initialView?: BoardSnapshot["initialView"]): BoardSnapshot {
    return { boardId: BOARD, revision: 1, snapshotId: "history-unchanged", initialView, updatedAt: NOW,
      query: { days: 7, repository: "all", compare: false }, scope: { since: START, until: NOW, timezone: "UTC" },
      coverage: { source: "git+github", complete: true, note: "Historical collection.", repositories: [] },
      configuration: { revision: 1, repositories: this.historyConfigured ? ["example-org/local"] : [], needsRefresh: false },
      account: null, collectedAt: this.historyConfigured ? NOW : null,
      buckets: [{ start: START, end: NOW, commits: 1, additions: 1, deletions: 0, unknownLineCommits: 0, previousCommits: null, mergedPRs: 0, recordIds: ["commit-1"] }],
      totals: { commits: 1, additions: 1, deletions: 0, unknownLineCommits: 0, previousCommits: null, mergedPRs: 0, openPRs: 0 }, pullRequestQueue: this.queue };
  }
  async tool(name: string, args: Record<string, unknown>): Promise<{ content: []; structuredContent: unknown }> {
    if (name === "read_board") return { content: [], structuredContent: this.snapshot() };
    if (name === "read_pull_request_queue") return { content: [], structuredContent: this.queue };
    if (name === "refresh_pull_requests") {
      if (this.refreshGate) await this.refreshGate;
      this.generation += 1;
      this.collected = true;
      return { content: [], structuredContent: this.queue };
    }
    if (name === "update_pull_request_queue") {
      assert.equal(args.expected_revision, this.revision);
      if (args.organization !== undefined && args.organization !== this.organization) {
        this.organization = String(args.organization); this.repository = "all"; this.collected = false;
      }
      if (args.repository !== undefined) this.repository = String(args.repository);
      if (args.attention !== undefined) this.attention = args.attention as typeof this.attention;
      if (args.days !== undefined) this.days = Number(args.days) as typeof this.days;
      this.revision += 1;
      return { content: [], structuredContent: this.queue };
    }
    if (name === "query_pull_requests") {
      const queue = this.queue;
      assert.equal(args.snapshot_id, queue.snapshotId);
      const sort = args.pull_request_sort as QueueSort;
      const direction = args.sort_direction as "asc" | "desc";
      let rows = [pr(queue.query.organization!, 1), pr(queue.query.organization!, 2, true), pr(queue.query.organization!, 3)];
      if (args.pull_request_state === "merged") rows = [];
      if (this.attention === "review") rows = rows.filter(row => row.attention?.group === "awaiting_review");
      rows.sort((a,b) => sort === "attention" ? (a.attention!.priority - b.attention!.priority || a.updatedAt.localeCompare(b.updatedAt)) : (direction === "asc" ? 1 : -1) * (sort === "number" ? a.number - b.number : a.updatedAt.localeCompare(b.updatedAt)));
      const offset = args.cursor ? 2 : 0;
      const evidence: PullRequestQueueEvidence = { boardId: BOARD, snapshotId: queue.snapshotId, query: queue.query, account: queue.account, coverage: queue.coverage, collectedAt: queue.collectedAt, needsRefresh: queue.needsRefresh,
        pullRequests: rows.slice(offset, offset + 2), totalPullRequests: rows.length, groups: queue.totals.groups, nextCursor: !offset && rows.length > 2 ? "next" : null,
        state: args.pull_request_state as "open" | "merged", sort, direction };
      if (this.queryGate) await this.queryGate;
      return { content: [], structuredContent: evidence };
    }
    if (name === "query_evidence") return { content: [], structuredContent: { boardId: BOARD, revision: 1, snapshotId: "history-unchanged", query: this.snapshot().query, scope: this.snapshot().scope, coverage: this.snapshot().coverage, bucketStart: START,
      records: [{ id: "commit-1", repository: "example-org/local", sha: "a".repeat(40), timestamp: START, subject: "Saved activity evidence", contributor: "Fixture Contributor", email: "contributor@example.invalid", additions: 1, deletions: 0, files: [], url: "https://github.com/example-org/local/commit/" + "a".repeat(40) }], pullRequests: [], nextCursor: null, totalRecords: 1, totalPullRequests: 0, kind: "activity" } };
    throw new Error(`Unexpected tool ${name}`);
  }
}

async function panel(workspace: QueueWorkspace, view: BoardSnapshot["initialView"] = "pullRequests") {
  const html = await readFile(new URL("../bundle/board.html", import.meta.url), "utf8");
  const host = new JSDOM("<!doctype html><html><body></body></html>");
  let guest: JSDOM | undefined;
  let closed = false;
  const errors: string[] = [];
  const calls: Array<{ name: string; arguments?: Record<string, unknown> }> = [];
  const contexts: SelectionContext[] = [];
  const messages: string[] = [];
  const transport: Transport = {
    async start() {}, async close() { transport.onclose?.(); },
    async send(message: JSONRPCMessage) { queueMicrotask(() => { if (guest && !closed) guest.window.dispatchEvent(new guest.window.MessageEvent("message", { data: structuredClone(message), source: host.window as unknown as MessageEventSource })); }); },
  };
  host.window.postMessage = ((message: unknown) => { queueMicrotask(() => { if (!closed) transport.onmessage?.(structuredClone(message) as JSONRPCMessage); }); }) as typeof host.window.postMessage;
  const bridge = new AppBridge(null, { name: "Queue test host", version: "1.0.0" }, { serverTools: {}, updateModelContext: { text: {}, structuredContent: {} }, message: { text: {} } }, { hostContext: { theme: "light", displayMode: "inline", locale: "en-US", timeZone: "UTC" } });
  bridge.oncalltool = async params => { calls.push(params); return await workspace.tool(params.name, params.arguments ?? {}) as CallToolResult; };
  bridge.onupdatemodelcontext = async params => { contexts.push(params.structuredContent as unknown as SelectionContext); return {}; };
  bridge.onmessage = async params => { messages.push(params.content.filter(item => item.type === "text").map(item => item.text).join("\n")); return {}; };
  bridge.oninitialized = () => { void bridge.sendToolInput({ arguments: {} }).then(() => bridge.sendToolResult({ content: [], structuredContent: { ...workspace.snapshot(view) } })); };
  await bridge.connect(transport);
  guest = new JSDOM(html, { url: "https://bigboard.test/queue", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: new VirtualConsole(), beforeParse(window) {
    Object.defineProperty(window, "parent", { value: host.window }); Object.defineProperty(window, "structuredClone", { value: structuredClone });
    Object.defineProperty(window, "ResizeObserver", { value: class { observe() {} unobserve() {} disconnect() {} } });
    window.addEventListener("error", event => errors.push(String(event.error ?? event.message)));
  } });
  await waitFor(() => contexts.length > 0, "initial queue context");
  return { document: guest.window.document, calls, contexts, messages, errors,
    sendSnapshot: () => bridge.sendToolResult({ content: [], structuredContent: { ...workspace.snapshot() } }),
    async close() { if (closed) return; await bridge.teardownResource({}, { timeout: 1000 }); guest!.window.dispatchEvent(new guest!.window.Event("pagehide")); closed = true; await bridge.close(); guest!.window.close(); host.window.close(); } };
}

test("organization PRs work without clones and use attention groups, their own controls, and an embedded icon", async t => {
  const workspace = new QueueWorkspace();
  const app = await panel(workspace); t.after(() => app.close());
  await waitFor(() => Boolean(app.document.querySelector('[data-pr-id="example-org/remote#2"]')), "organization PRs");
  assert.equal(app.calls.filter(call => call.name === "refresh_pull_requests").length, 1);
  assert.equal(app.calls.filter(call => call.name === "refresh_sources").length, 0);
  assert.equal(app.document.querySelector<HTMLSelectElement>('select[aria-label="PR attention"]')?.value, "all");
  assert.equal(app.document.querySelector('input[type="checkbox"][aria-label="Compare previous period"]'), null);
  assert.equal(app.document.querySelector('[aria-label="Date range"]'), null);
  assert.equal(app.document.querySelector('[aria-label="PR history period"]'), null);
  assert.match(app.document.querySelector<HTMLImageElement>(".wordmark img")!.src, /^data:image\/png;base64,/);
  const firstPR = app.document.querySelector<HTMLElement>("[data-pr-id]")!;
  assert.equal(firstPR.dataset.prId, "example-org/remote#2");
  assert.match(app.document.querySelector(".pr-attention-group")!.textContent!, /Awaiting your review/);
  assert.match(app.document.body.textContent!, /Your review was explicitly requested/);
  assert.match(app.document.body.textContent!, /@fixture-reviewer/);
  assert.equal(app.contexts.at(-1)!.snapshotId, workspace.queue.snapshotId);
  assert.equal(app.contexts.at(-1)!.pullRequestQuery?.organization, "example-org");
  assert.deepEqual(app.errors, []);
});

test("queue sorting preserves exact PR selections and shares organization-bound context without recollecting", async t => {
  const workspace = new QueueWorkspace();
  const app = await panel(workspace); t.after(() => app.close());
  await waitFor(() => Boolean(app.document.querySelector('[data-pr-id="example-org/remote#2"]')), "queue rows");
  const selected = app.document.querySelector<HTMLInputElement>('input[aria-label="Select example-org/remote#2"]')!;
  selected.click();
  await waitFor(() => app.contexts.at(-1)?.selectedPullRequests?.length === 1, "selected queue context");
  const head = app.contexts.at(-1)!.selectedPullRequests![0].headSha;
  choose(app.document, "PR sort", "number");
  await waitFor(() => app.calls.some(call => call.name === "query_pull_requests" && call.arguments?.pull_request_sort === "number"), "queue sort");
  await waitFor(() => app.contexts.at(-1)?.pullRequestSort === "number", "sorted context");
  assert.equal(app.contexts.at(-1)!.selectedPullRequests![0].headSha, head);
  button(app.document, "Load more pull requests").click();
  await waitFor(() => app.document.querySelectorAll("[data-pr-id]").length === 3, "next PR page");
  button(app.document, "Request code reviews").click();
  await waitFor(() => app.messages.length === 1, "review request");
  assert.match(app.messages[0], /Review the 1 pull request/);
  assert.doesNotMatch(app.messages[0], /headSha|snapshotId|[{}]/);
  assert.equal(app.contexts.at(-1)!.reviewer?.login, "fixture-reviewer");
  assert.equal(app.calls.filter(call => call.name === "refresh_pull_requests").length, 1);
  choose(app.document, "PR attention", "review");
  await waitFor(() => app.contexts.at(-1)?.pullRequestQuery?.attention === "review", "attention scope");
  assert.deepEqual(app.contexts.at(-1)!.selectedPullRequests, []);
  assert.equal(app.calls.filter(call => call.name === "update_board").length, 0);
  assert.deepEqual(app.errors, []);
});

test("PR refreshes and query changes leave Activity evidence and history scope independent", async t => {
  const workspace = new QueueWorkspace(); workspace.historyConfigured = true;
  const app = await panel(workspace, "activity"); t.after(() => app.close());
  await waitFor(() => Boolean(app.document.querySelector('section[aria-label="Daily commits"] button')), "history chart");
  app.document.querySelector<HTMLButtonElement>('section[aria-label="Daily commits"] button')!.click();
  await waitFor(() => app.document.body.textContent!.includes("Saved activity evidence"), "selected history evidence");
  const priorContext = app.contexts.at(-1)!;
  workspace.generation += 1;
  await app.sendSnapshot();
  assert.match(app.document.body.textContent!, /Saved activity evidence/);
  assert.equal(app.contexts.at(-1)!.snapshotId, priorContext.snapshotId);
  button(app.document, "Pull requests").click();
  await waitFor(() => Boolean(app.document.querySelector('[data-pr-id="example-org/remote#2"]')), "queue after history");
  button(app.document, "Merged").click();
  await waitFor(() => Boolean(app.document.querySelector('[aria-label="PR history period"]')), "independent merged period");
  choose(app.document, "PR history period", "30");
  await waitFor(() => workspace.days === 30, "PR-only date update");
  assert.equal(app.calls.filter(call => call.name === "update_board").length, 0);
  button(app.document, "Activity").click();
  await waitFor(() => app.document.body.textContent!.includes("Saved activity evidence"), "restored history evidence");
  assert.equal(app.contexts.at(-1)!.query.days, 7);
  assert.equal(app.calls.filter(call => call.name === "refresh_sources").length, 0);
  assert.deepEqual(app.errors, []);
});


test("a late organization query cannot replace the current scope or restore an obsolete selection", async t => {
  const workspace = new QueueWorkspace();
  const app = await panel(workspace); t.after(() => app.close());
  await waitFor(() => Boolean(app.document.querySelector('[data-pr-id="example-org/remote#2"]')), "initial organization rows");
  app.document.querySelector<HTMLInputElement>('input[aria-label="Select example-org/remote#2"]')!.click();
  await waitFor(() => app.contexts.at(-1)?.selectedPullRequests?.length === 1, "initial selected PR");
  let release!: () => void;
  workspace.queryGate = new Promise<void>(resolve => { release = resolve; });
  choose(app.document, "PR sort", "number");
  await waitFor(() => app.calls.some(call => call.name === "query_pull_requests" && call.arguments?.pull_request_sort === "number"), "pending old organization query");
  workspace.organization = "other-org";
  workspace.revision += 1;
  workspace.queryGate = null;
  await app.sendSnapshot();
  await waitFor(() => Boolean(app.document.querySelector('[data-pr-id="other-org/remote#1"]')), "new organization rows");
  release();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(app.document.querySelector('[data-pr-id="example-org/remote#2"]'), null);
  assert.equal(app.contexts.at(-1)!.pullRequestQuery?.organization, "other-org");
  assert.deepEqual(app.contexts.at(-1)!.selectedPullRequests, []);
  assert.deepEqual(app.errors, []);
});

test("changing organizations during collection refreshes the new organization after the old request finishes", async t => {
  const workspace = new QueueWorkspace();
  let release!: () => void;
  workspace.refreshGate = new Promise<void>(resolve => { release = resolve; });
  const app = await panel(workspace); t.after(() => app.close());
  await waitFor(() => app.calls.some(call => call.name === "refresh_pull_requests"), "initial pending refresh");
  workspace.organization = "other-org";
  workspace.revision += 1;
  workspace.collected = false;
  await app.sendSnapshot();
  workspace.refreshGate = null;
  release();
  await waitFor(() => Boolean(app.document.querySelector('[data-pr-id="other-org/remote#2"]')), "refreshed new organization");
  assert.equal(app.calls.filter(call => call.name === "refresh_pull_requests").length, 2);
  assert.equal(app.calls.filter(call => call.name === "refresh_sources").length, 0);
  assert.equal(app.contexts.at(-1)!.pullRequestQuery?.organization, "other-org");
  assert.deepEqual(app.errors, []);
});

test("an organization can be opened from the PR controls without configuring local repositories", async t => {
  const workspace = new QueueWorkspace(); workspace.organization = null; workspace.collected = false;
  const app = await panel(workspace); t.after(() => app.close());
  await waitFor(() => Boolean(app.document.querySelector('[aria-label="Choose PR organization"]')), "organization empty state");
  assert.equal(app.calls.filter(call => call.name === "refresh_pull_requests").length, 0);
  const input = app.document.querySelector<HTMLInputElement>('input[aria-label="GitHub organization"]')!;
  const setter = Object.getOwnPropertyDescriptor(app.document.defaultView!.HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, "example-org");
  input.dispatchEvent(new app.document.defaultView!.Event("input", { bubbles: true }));
  await waitFor(() => !button(app.document, "Apply").disabled, "edited organization");
  input.closest("form")!.dispatchEvent(new app.document.defaultView!.Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(() => Boolean(app.document.querySelector('[data-pr-id="example-org/remote#2"]')), "new organization collection");
  assert.equal(app.calls.filter(call => call.name === "refresh_pull_requests").length, 1);
  assert.equal(app.calls.filter(call => call.name === "configure_sources" || call.name === "refresh_sources").length, 0);
  assert.deepEqual(app.errors, []);
});


test("an older cached refresh in a different organization cannot prevent switching the PR scope", async t => {
  const workspace = new QueueWorkspace();
  workspace.refresh = { id: "newer-a", status: "complete", phase: "finished", startedAt: NOW, updatedAt: NOW, finishedAt: NOW, completed: 3, total: 3, requests: 4, message: "Organization A checked." };
  const app = await panel(workspace); t.after(() => app.close());
  await waitFor(() => Boolean(app.document.querySelector('[data-pr-id="example-org/remote#2"]')), "first organization");
  workspace.organization = "other-org";
  workspace.revision += 1;
  workspace.refresh = { ...workspace.refresh, id: "older-b", startedAt: START, updatedAt: START, finishedAt: START, completed: 1, total: 1, requests: 2, message: "Organization B checked earlier." };
  await app.sendSnapshot();
  await waitFor(() => Boolean(app.document.querySelector('[data-pr-id="other-org/remote#2"]')), "organization with older cached refresh");
  assert.equal(app.document.querySelector<HTMLInputElement>('input[aria-label="GitHub organization"]')!.value, "other-org");
  assert.equal(app.contexts.at(-1)!.pullRequestQuery?.organization, "other-org");
  assert.deepEqual(app.errors, []);
});
