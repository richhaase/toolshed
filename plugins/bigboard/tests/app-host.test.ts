import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { AppBridge } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { CallToolResult, JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { JSDOM, VirtualConsole } from "jsdom";
import type { ActivityRecord, BoardQuery, BoardSnapshot, EvidenceResult, PeopleResult, PersonSummary, PullRequestRecord, RefreshProgress, SelectionContext } from "../src/shared.js";

type ContextUpdate = Parameters<NonNullable<AppBridge["onupdatemodelcontext"]>>[0];
type ChatMessage = Parameters<NonNullable<AppBridge["onmessage"]>>[0];
type ContextSupport = "structured" | "text" | "none";
const DAY = 86_400_000;
const END = Date.parse("2026-11-17T12:00:00.000Z");

async function waitFor(predicate: () => boolean, description: string, timeout = 6000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function dailyButtons(document: Document): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('section[aria-label="Daily commits"] button[aria-pressed]')];
}

function button(document: Document, label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.getAttribute("aria-label") === label || item.textContent?.replace("↗", "").trim() === label);
  assert.ok(found, `Missing ${label} button`);
  return found;
}

function choose(document: Document, label: string, value: string): void {
  const found = [...document.querySelectorAll<HTMLSelectElement>("select")].find(item => item.getAttribute("aria-label") === label || item.closest("label")?.textContent?.startsWith(label));
  assert.ok(found, `Missing ${label} select`);
  found.value = value;
  found.dispatchEvent(new document.defaultView!.Event("change", { bubbles: true }));
}

function humanMessage(message: ChatMessage, context: SelectionContext): string {
  assert.equal(message.role, "user");
  assert.equal(message.content.length, 1);
  const content = message.content[0];
  assert.equal(content.type, "text");
  const text = content.type === "text" ? content.text : "";
  assert.ok(text.trim().length > 0);
  assert.doesNotMatch(text, /[{}]|boardId|snapshotId|recordIds|bucket_start|person_id|query_evidence|headSha|requestedReviewers/);
  assert.ok(!text.includes(context.boardId));
  assert.ok(!text.includes(context.snapshotId));
  return text;
}

function refreshProgress(git: number, github: number, status: RefreshProgress["status"] = "running", message = "Collecting repository evidence."): RefreshProgress {
  return {
    id: "synthetic-refresh", status, startedAt: new Date(END).toISOString(), updatedAt: new Date(END + (git + github) * 1000).toISOString(),
    finishedAt: status === "running" ? null : new Date(END + 10_000).toISOString(),
    git: { completedRepositories: git, totalRepositories: 2 }, github: { completedRepositories: github, totalRepositories: 2, requests: github * 2 + 1 }, message,
  };
}

function refreshSection(document: Document): HTMLElement | null {
  return document.querySelector<HTMLElement>('[aria-label="Source refresh progress"]');
}

function refreshButton(document: Document): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>("button.refresh-sources");
  assert.ok(found);
  return found;
}

function processed(document: Document, source: "Git" | "GitHub"): number | null {
  return document.querySelector<HTMLProgressElement>(`progress[aria-label="${source} repositories processed"]`)?.value ?? null;
}

class Workspace {
  boards = new Map<string, { revision: number; query: BoardQuery }>();
  generation = 1;
  configured = true;
  collected = true;
  account: BoardSnapshot["account"] = { id: "1", login: "sample-user" };
  refresh: RefreshProgress | null = null;
  refreshOperation: (() => Promise<void>) | null = null;
  refreshFailure: string | null = null;
  delayEvidence: ((args: Record<string, unknown>) => Promise<void>) | null = null;
  delayPeople: ((args: Record<string, unknown>) => Promise<void>) | null = null;
  completedEvidence: Array<Record<string, unknown>> = [];
  completedPeople: Array<Record<string, unknown>> = [];
  readonly records: ActivityRecord[] = Array.from({ length: 62 }, (_, index) => ({
    id: `sample/${index % 2 ? "web" : "api"}:${index.toString(16).padStart(40, "0")}`,
    repository: `sample/${index % 2 ? "web" : "api"}`,
    sha: index.toString(16).padStart(40, "0"),
    timestamp: new Date(END - (28 - (index >= 56 ? 24 : Math.floor(index / 2))) * DAY + (index >= 56 ? index - 54 : 1) * 3_600_000).toISOString(),
    subject: `Improve activity record ${index + 1}`,
    contributor: `Contributor ${index % 2 ? "B" : "A"}`,
    email: `contributor-${index % 2}@example.test`,
    additions: index === 48 ? null : 10 + index,
    deletions: index === 48 ? null : 2,
    files: [],
    url: `https://github.com/sample/${index % 2 ? "web" : "api"}/commit/${index.toString(16).padStart(40, "0")}`,
  }));
  readonly prs: PullRequestRecord[] = [
    { id: "sample/api#2", repository: "sample/api", number: 2, title: "Improve activity loading", url: "https://github.com/sample/api/pull/2", author: "contributor-a", state: "merged", draft: false, createdAt: "2026-11-01T09:00:00Z", updatedAt: "2026-11-15T13:00:00Z", mergedAt: "2026-11-15T13:00:00Z", baseBranch: "main", headSha: "a".repeat(40) },
    { id: "sample/web#9", repository: "sample/web", number: 9, title: "An older draft still open", url: "https://github.com/sample/web/pull/9", author: "contributor-b", state: "open", draft: true, createdAt: "2026-05-01T09:00:00Z", updatedAt: "2026-11-16T10:00:00Z", mergedAt: null, baseBranch: "main", headSha: "b".repeat(40) },
    { id: "sample/api#10", repository: "sample/api", number: 10, title: "Refine API loading", url: "https://github.com/sample/api/pull/10", author: "contributor-a", state: "open", draft: false, createdAt: "2026-11-10T09:00:00Z", updatedAt: "2026-11-16T11:00:00Z", mergedAt: null, baseBranch: "main", headSha: "c".repeat(40) },
    { id: "sample/web#11", repository: "sample/web", number: 11, title: "Improve keyboard navigation", url: "https://github.com/sample/web/pull/11", author: "contributor-b", state: "open", draft: false, createdAt: "2026-11-12T09:00:00Z", updatedAt: "2026-11-14T11:00:00Z", mergedAt: null, baseBranch: "main", headSha: "d".repeat(40) },
    { id: "sample/api#12", repository: "sample/api", number: 12, title: "Add retry coverage", url: "https://github.com/sample/api/pull/12", author: "contributor-a", state: "open", draft: false, createdAt: "2026-11-12T09:00:00Z", updatedAt: "2026-11-13T11:00:00Z", mergedAt: null, baseBranch: "main", headSha: "e".repeat(40) },
    { id: "sample/web#13", repository: "sample/web", number: 13, title: "Update source status", url: "https://github.com/sample/web/pull/13", author: "contributor-b", state: "merged", draft: false, createdAt: "2026-11-11T09:00:00Z", updatedAt: "2026-11-13T15:00:00Z", mergedAt: "2026-11-13T15:00:00Z", baseBranch: "main", headSha: "f".repeat(40) },
    { id: "sample/api#1", repository: "sample/api", number: 1, title: "An older merged change", url: "https://github.com/sample/api/pull/1", author: "contributor-a", state: "merged", draft: false, createdAt: "2026-10-01T09:00:00Z", updatedAt: "2026-10-25T13:00:00Z", mergedAt: "2026-10-25T13:00:00Z", baseBranch: "main", headSha: "1".repeat(40) },
  ];

  open(): BoardSnapshot {
    const boardId = `00000000-0000-4000-8000-${(this.boards.size + 1).toString().padStart(12, "0")}`;
    this.boards.set(boardId, { revision: 1, query: { days: 7, repository: "all", compare: false } });
    return this.snapshot(boardId);
  }

  snapshot(boardId: string): BoardSnapshot {
    const saved = this.boards.get(boardId);
    assert.ok(saved);
    const query = saved.query;
    const since = END - query.days * DAY;
    const included = this.records.filter(record => query.repository === "all" || record.repository === query.repository);
    const current = this.collected ? included.filter(record => Date.parse(record.timestamp) >= since && Date.parse(record.timestamp) < END) : [];
    const previous = included.filter(record => Date.parse(record.timestamp) >= since - query.days * DAY && Date.parse(record.timestamp) < since);
    const prs = this.collected ? this.prs.filter(pr => query.repository === "all" || pr.repository === query.repository) : [];
    const buckets = Array.from({ length: query.days }, (_, index) => {
      const start = since + index * DAY;
      const end = start + DAY;
      const records = current.filter(record => Date.parse(record.timestamp) >= start && Date.parse(record.timestamp) < end);
      return {
        start: new Date(start).toISOString(), end: new Date(end).toISOString(), commits: records.length,
        additions: records.reduce((sum, record) => sum + (record.additions ?? 0), 0), deletions: records.reduce((sum, record) => sum + (record.deletions ?? 0), 0),
        unknownLineCommits: records.filter(record => record.additions === null).length,
        previousCommits: query.compare ? previous.filter(record => Date.parse(record.timestamp) >= start - query.days * DAY && Date.parse(record.timestamp) < end - query.days * DAY).length : null,
        mergedPRs: prs.filter(pr => pr.mergedAt && Date.parse(pr.mergedAt) >= start && Date.parse(pr.mergedAt) < end).length,
        recordIds: records.map(record => record.id),
      };
    });
    return {
      boardId, revision: saved.revision, snapshotId: `${boardId}:${saved.revision}:${this.generation}`, updatedAt: new Date(END).toISOString(), query: { ...query }, refresh: this.refresh,
      scope: { since: new Date(since).toISOString(), until: new Date(END).toISOString(), timezone: "UTC" },
      coverage: { source: "git+github", complete: false, note: this.collected ? "Some line evidence is unavailable. Git remote-tracking refs were read without fetching." : "Refresh sources to collect evidence.", repositories: this.configured ? ["sample/api", "sample/web"].map(repository => ({ repository, revision: "a".repeat(40), ref: "refs/remotes/origin/main", shallow: false, partial: true, historyComplete: true, linesComplete: false, openPRsComplete: true, mergedPRsComplete: true, errors: ["Line evidence is incomplete."] })) : [] },
      configuration: { revision: 1, repositories: this.configured ? ["sample/api", "sample/web"] : [], needsRefresh: !this.collected },
      account: this.account, collectedAt: this.collected ? new Date(END + this.generation * 1000).toISOString() : null, buckets,
      totals: { commits: current.length, additions: buckets.reduce((sum, item) => sum + item.additions, 0), deletions: buckets.reduce((sum, item) => sum + item.deletions, 0), unknownLineCommits: buckets.reduce((sum, item) => sum + item.unknownLineCommits, 0), previousCommits: query.compare ? previous.length : null, mergedPRs: prs.filter(pr => pr.mergedAt && Date.parse(pr.mergedAt) >= since && Date.parse(pr.mergedAt) < END).length, openPRs: prs.filter(pr => pr.state === "open").length },
    };
  }

  people(snapshot: BoardSnapshot, source: "git" | "github"): PersonSummary[] {
    const people = new Map<string, PersonSummary>();
    const person = (identity: string, name: string): PersonSummary => {
      const id = `${source}:${identity}`;
      if (!people.has(id)) people.set(id, { id, source, name, identity, commits: 0, additions: 0, deletions: 0, unknownLineCommits: 0, openPRs: 0, mergedPRs: 0, repositories: [] });
      return people.get(id)!;
    };
    if (!this.collected) return [];
    if (source === "git") {
      for (const record of this.records.filter(record => (snapshot.query.repository === "all" || record.repository === snapshot.query.repository) && record.timestamp >= snapshot.scope.since && record.timestamp < snapshot.scope.until)) {
        const summary = person(record.email, record.contributor);
        summary.commits += 1;
        summary.additions += record.additions ?? 0;
        summary.deletions += record.deletions ?? 0;
        summary.unknownLineCommits += record.additions === null || record.deletions === null ? 1 : 0;
        if (!summary.repositories.includes(record.repository)) summary.repositories.push(record.repository);
      }
    } else {
      for (const pr of this.prs.filter(pr => (snapshot.query.repository === "all" || pr.repository === snapshot.query.repository) && (pr.state === "open" || (pr.mergedAt! >= snapshot.scope.since && pr.mergedAt! < snapshot.scope.until)))) {
        const summary = person(pr.author, pr.author);
        if (pr.state === "open") summary.openPRs += 1;
        else summary.mergedPRs += 1;
        if (!summary.repositories.includes(pr.repository)) summary.repositories.push(pr.repository);
      }
    }
    return [...people.values()].sort((a,b) => (source === "git" ? b.commits - a.commits : b.openPRs + b.mergedPRs - a.openPRs - a.mergedPRs) || a.identity.localeCompare(b.identity));
  }

  async tool(params: { name: string; arguments?: Record<string, unknown> }): Promise<CallToolResult> {
    const args = params.arguments ?? {};
    if (params.name === "refresh_sources") {
      await this.refreshOperation?.();
      if (this.refreshFailure) return { isError: true, content: [{ type: "text", text: this.refreshFailure }] };
      this.collected = true;
      this.generation += 1;
      return { content: [], structuredContent: { collectionId: `collection-${this.generation}`, complete: false } };
    }
    const boardId = String(args.board_id);
    const snapshot = this.snapshot(boardId);
    if (params.name === "read_board") return { content: [], structuredContent: { ...snapshot } };
    if (params.name === "update_board") {
      const saved = this.boards.get(boardId)!;
      if (args.expected_revision !== saved.revision) return { isError: true, content: [{ type: "text", text: "Read the current revision." }] };
      saved.revision += 1;
      saved.query = { ...saved.query, ...(args.repository === undefined ? {} : { repository: String(args.repository) }), ...(args.days === undefined ? {} : { days: args.days as 7 | 14 }), ...(args.compare === undefined ? {} : { compare: Boolean(args.compare) }) };
      return { content: [], structuredContent: { ...this.snapshot(boardId) } };
    }
    if (args.snapshot_id !== snapshot.snapshotId) return { isError: true, content: [{ type: "text", text: "The selected snapshot changed." }] };
    if (params.name === "query_people") {
      await this.delayPeople?.(args);
      const source = args.source as "git" | "github";
      const people = this.people(snapshot, source);
      const signature = JSON.stringify([snapshot.snapshotId, source]);
      let offset = 0;
      if (args.cursor) {
        const decoded = JSON.parse(Buffer.from(String(args.cursor), "base64url").toString("utf8"));
        if (decoded[0] !== signature) return { isError: true, content: [{ type: "text", text: "The people cursor changed scope." }] };
        offset = decoded[1];
      }
      const nextOffset = offset + 3;
      const result: PeopleResult = { boardId, revision: snapshot.revision, snapshotId: snapshot.snapshotId, query: snapshot.query, scope: snapshot.scope, coverage: snapshot.coverage, source, people: people.slice(offset, nextOffset), totalPeople: people.length, nextCursor: people.length > nextOffset ? Buffer.from(JSON.stringify([signature, nextOffset])).toString("base64url") : null };
      this.completedPeople.push(args);
      return { content: [], structuredContent: { ...result } };
    }
    assert.equal(params.name, "query_evidence");
    await this.delayEvidence?.(args);
    const kind = args.kind;
    assert.ok(kind === "activity" || kind === "pull_requests");
    const personId = args.person_id as string | undefined;
    const selectedPerson = personId ? [...this.people(snapshot, "git"), ...this.people(snapshot, "github")].find(person => person.id === personId) : undefined;
    if (personId && !selectedPerson) return { isError: true, content: [{ type: "text", text: "The selected person is unavailable." }] };
    const bucket = snapshot.buckets.find(item => item.start === args.bucket_start);
    const records = kind === "activity" && this.collected ? this.records.filter(record => (snapshot.query.repository === "all" || record.repository === snapshot.query.repository) && (!selectedPerson || selectedPerson.source === "git" && record.email === selectedPerson.identity) && record.timestamp >= (bucket?.start ?? snapshot.scope.since) && record.timestamp < (bucket?.end ?? snapshot.scope.until)).sort((a,b) => b.timestamp.localeCompare(a.timestamp) || a.id.localeCompare(b.id)) : [];
    const prs = kind === "pull_requests" && this.collected ? this.prs.filter(pr => (snapshot.query.repository === "all" || pr.repository === snapshot.query.repository) && selectedPerson?.source === "github" && pr.author === selectedPerson.identity && (pr.state === "open" || (pr.mergedAt! >= snapshot.scope.since && pr.mergedAt! < snapshot.scope.until))).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)) : [];
    const signature = JSON.stringify([snapshot.snapshotId, args.bucket_start ?? null, kind, personId ?? null]);
    let offset = 0;
    if (args.cursor) {
      const decoded = JSON.parse(Buffer.from(String(args.cursor), "base64url").toString("utf8"));
      if (decoded[0] !== signature) return { isError: true, content: [{ type: "text", text: "The evidence cursor changed scope." }] };
      offset = decoded[1];
    }
    const nextOffset = offset + 3;
    const evidence: EvidenceResult = { boardId, revision: snapshot.revision, snapshotId: snapshot.snapshotId, query: snapshot.query, scope: snapshot.scope, coverage: snapshot.coverage, bucketStart: bucket?.start ?? null, kind, selectedPersonId: personId, records: records.slice(offset, nextOffset), pullRequests: prs.slice(offset, nextOffset), nextCursor: Math.max(records.length, prs.length) > nextOffset ? Buffer.from(JSON.stringify([signature, nextOffset])).toString("base64url") : null, totalRecords: records.length, totalPullRequests: prs.length };
    this.completedEvidence.push(args);
    return { content: [], structuredContent: { ...evidence } };
  }
}

async function panel(workspace: Workspace, initial: Omit<BoardSnapshot, "initialView"> & { initialView?: BoardSnapshot["initialView"] | "pullRequests" }, contextSupport: ContextSupport = "structured", options: { waitForInitialContext?: boolean; initialResult?: Promise<void> } = {}) {
  const html = await readFile(new URL("../bundle/board.html", import.meta.url), "utf8");
  const host = new JSDOM("<!doctype html><html><body></body></html>");
  const contexts: ContextUpdate[] = [];
  const messages: ChatMessage[] = [];
  const calls: Array<{ name: string; arguments?: Record<string, unknown> }> = [];
  const errors: string[] = [];
  let guest: JSDOM | undefined;
  let closed = false;
  let initialized = false;
  let rejectContext = false;
  let rejectMessage = false;
  const transport: Transport = {
    async start() {},
    async close() { transport.onclose?.(); },
    async send(message: JSONRPCMessage) {
      queueMicrotask(() => {
        if (!guest || closed) return;
        guest.window.dispatchEvent(new guest.window.MessageEvent("message", { data: structuredClone(message), source: host.window as unknown as MessageEventSource }));
      });
    },
  };
  host.window.postMessage = ((message: unknown) => { queueMicrotask(() => { if (!closed) transport.onmessage?.(structuredClone(message) as JSONRPCMessage); }); }) as typeof host.window.postMessage;
  const updateModelContext = contextSupport === "structured" ? { text: {}, structuredContent: {} } : contextSupport === "text" ? { text: {} } : {};
  const bridge = new AppBridge(null, { name: "BigBoard test host", version: "1.0.0" }, { serverTools: {}, updateModelContext, message: { text: {} } }, { hostContext: { theme: "light", displayMode: "inline", locale: "en-US", timeZone: "UTC" } });
  bridge.oncalltool = async (params) => { calls.push(params); return workspace.tool(params); };
  bridge.onupdatemodelcontext = async (params) => {
    if (rejectContext) throw new Error("Context sharing unavailable");
    contexts.push(params);
    return {};
  };
  bridge.onmessage = async (params) => {
    if (rejectMessage) return { isError: true };
    messages.push(params);
    return {};
  };
  bridge.oninitialized = () => { initialized = true; void bridge.sendToolInput({ arguments: {} }).then(() => options.initialResult ? options.initialResult.then(() => bridge.sendToolResult({ content: [], structuredContent: { ...initial } })) : bridge.sendToolResult({ content: [], structuredContent: { ...initial } })).catch((error) => errors.push(String(error))); };
  await bridge.connect(transport);
  guest = new JSDOM(html, { url: "https://bigboard.test/activity", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: new VirtualConsole(), beforeParse(window) {
    Object.defineProperty(window, "parent", { value: host.window });
    Object.defineProperty(window, "structuredClone", { value: structuredClone });
    Object.defineProperty(window, "ResizeObserver", { value: class { observe() {} unobserve() {} disconnect() {} } });
    window.addEventListener("error", (event) => errors.push(String(event.error ?? event.message)));
  } });
  await waitFor(() => initialized && (options.waitForInitialContext === false ? Boolean(guest?.window.document.querySelector('nav[aria-label="Board views"]')) : contexts.length > 0 || contextSupport === "none" && Boolean(guest?.window.document.querySelector('[role="alert"]'))), "MCP Apps handshake and initial context");
  const document = guest.window.document;
  const selectedContext = (): SelectionContext => {
    const context = contexts.at(-1);
    if (context?.structuredContent) return context.structuredContent as unknown as SelectionContext;
    const text = context?.content?.filter(item => item.type === "text").map(item => item.text).join("\n");
    return text ? JSON.parse(text.slice(text.indexOf("{"))) as SelectionContext : undefined as unknown as SelectionContext;
  };
  const close = async () => {
    if (closed || !guest) return;
    await bridge.teardownResource({}, { timeout: 1000 });
    guest.window.dispatchEvent(new guest.window.Event("pagehide"));
    closed = true;
    await bridge.close();
    guest.window.close();
    host.window.close();
  };
  return { document, contexts, messages, calls, errors, selectedContext, close, sendSnapshot: (snapshot: BoardSnapshot) => bridge.sendToolResult({ content: [], structuredContent: { ...snapshot } }), rejectContext: (value: boolean) => { rejectContext = value; }, rejectMessage: (value: boolean) => { rejectMessage = value; } };
}

test("Activity stays quiet until a bucket is selected, then shares only its supporting commits", async t => {
  const workspace = new Workspace();
  const initial = workspace.open();
  const first = await panel(workspace, initial);
  t.after(first.close);
  await waitFor(() => dailyButtons(first.document).length === 7, "Activity chart");
  assert.deepEqual([...first.document.querySelectorAll('nav[aria-label="Board views"] button')].map(item => item.textContent), ["Activity", "People"]);
  assert.equal(first.calls.filter(call => call.name === "query_evidence").length, 0);
  assert.equal(first.document.querySelector('[aria-label="Commit records"]'), null);
  assert.equal(first.document.querySelector('[aria-label="Pull request records"]'), null);
  assert.equal(first.document.querySelector('[aria-label="Activity evidence"]'), null);
  assert.equal(first.document.querySelector('[aria-label="Selected evidence"]'), null);
  assert.equal(first.document.querySelector('[aria-label="Pull request evidence"]'), null);
  assert.equal(first.selectedContext().view, "activity");
  const bucket = initial.buckets.find(item => item.commits > 3)!;
  const index = initial.buckets.indexOf(bucket);
  dailyButtons(first.document)[index].click();
  await waitFor(() => first.document.querySelectorAll('[aria-label="Commit records"] article').length === 3, "selected Activity evidence");
  const query = first.calls.find(call => call.name === "query_evidence")!;
  assert.equal(query.arguments?.kind, "activity");
  assert.equal(query.arguments?.bucket_start, bucket.start);
  assert.equal(first.document.querySelector('[aria-label="Pull request records"]'), null);
  assert.equal(first.selectedContext().bucketStart, bucket.start);
  assert.deepEqual(first.selectedContext().recordIds, bucket.recordIds);
  assert.equal(first.selectedContext().snapshotId, initial.snapshotId);
  assert.equal(first.messages.length, 0);
  assert.ok(first.contexts.every(context => context.content === undefined));
  button(first.document, "Explain selection").click();
  await waitFor(() => first.messages.length === 1, "Activity follow-up");
  assert.match(humanMessage(first.messages[0], first.selectedContext()), /activity/i);
  assert.equal(first.selectedContext().bucketStart, bucket.start);
  button(first.document, "Load more evidence").click();
  await waitFor(() => first.document.querySelectorAll('[aria-label="Commit records"] article').length === 6, "selected Activity next page");
  button(first.document, "Load more evidence").click();
  await waitFor(() => first.document.querySelectorAll('[aria-label="Commit records"] article').length === bucket.commits, "all selected commit records");
  assert.ok(first.document.querySelector('[aria-label="Commit records"]')?.textContent?.includes("unknown"));
  const evidenceCalls = first.calls.filter(call => call.name === "query_evidence").length;
  button(first.document, "Close activity evidence").click();
  await waitFor(() => first.document.querySelector('[aria-label="Activity evidence"]') === null && first.selectedContext()?.bucketStart === null, "dismissed Activity detail");
  assert.equal(first.calls.filter(call => call.name === "query_evidence").length, evidenceCalls);
  assert.deepEqual(first.errors, []);
});

test("a restored Pull requests view opens Activity without starting collection", async t => {
  const workspace = new Workspace();
  const first = await panel(workspace, { ...workspace.open(), initialView: "pullRequests" });
  t.after(first.close);
  assert.equal(first.document.querySelector("h1")?.textContent, "Activity");
  assert.equal(first.selectedContext().view, "activity");
  assert.ok(first.calls.every(call => call.name === "read_board"));
  assert.deepEqual(first.errors, []);
});

test("late Activity evidence cannot replace a newer People selection or reuse its cursor", async t => {
  const workspace = new Workspace();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  workspace.delayEvidence = args => args.kind === "activity" ? gate : Promise.resolve();
  const initial = workspace.open();
  const first = await panel(workspace, initial);
  t.after(first.close);
  await waitFor(() => dailyButtons(first.document).length === 7, "initial Activity chart");
  dailyButtons(first.document)[0].click();
  await waitFor(() => first.calls.some(call => call.name === "query_evidence" && call.arguments?.kind === "activity"), "delayed Activity query");
  button(first.document, "People").click();
  await waitFor(() => first.document.querySelector('[aria-label="People source"]') !== null, "People navigation");
  button(first.document, "GitHub authors").click();
  const person = workspace.people(initial, "github")[0];
  await waitFor(() => first.document.querySelector(`[data-person-id="${person.id}"]`) !== null, "GitHub authors");
  button(first.document, `Select person ${person.name}: ${person.identity}`).click();
  await waitFor(() => first.document.querySelector('[aria-label="Person pull requests"]') !== null, "person PR evidence");
  release();
  await waitFor(() => workspace.completedEvidence.some(args => args.kind === "activity"), "late Activity completion");
  assert.equal(first.document.querySelector('[aria-label="Activity evidence"]'), null);
  assert.equal(first.document.querySelector('[aria-label="Commit records"]'), null);
  assert.equal(first.selectedContext().personId, person.id);
  assert.ok(first.document.querySelector('[aria-label="Person pull requests"]'));
  const queries = first.calls.filter(call => call.name === "query_evidence" && call.arguments?.person_id === person.id);
  assert.ok(queries.length > 0);
  assert.ok(queries.every(call => call.arguments?.cursor === undefined));
  assert.deepEqual(first.errors, []);
});

test("compact source status preserves diagnostics and explicit refresh while agent updates keep the same board", async t => {
  const workspace = new Workspace();
  const initial = workspace.open();
  const first = await panel(workspace, initial);
  t.after(first.close);
  await waitFor(() => dailyButtons(first.document).length === 7, "initial Activity chart");
  assert.equal(first.calls.some(call => call.name === "refresh_sources"), false);
  const details = [...first.document.querySelectorAll("details")].find(detail => detail.textContent?.includes("Line evidence is incomplete"));
  assert.ok(details, "Coverage remains accessible");
  assert.equal(details.open, false);
  details.querySelector("summary")?.click();
  assert.equal(details.open, true);
  assert.ok(details.textContent?.includes("refs/remotes/origin/main"));
  const before = first.selectedContext().snapshotId;
  button(first.document, "Refresh sources").click();
  await waitFor(() => first.selectedContext()?.snapshotId !== before, "explicit source refresh");
  assert.equal(first.calls.filter(call => call.name === "refresh_sources").length, 1);
  const root = first.document.getElementById("root");
  await workspace.tool({ name: "update_board", arguments: { board_id: initial.boardId, expected_revision: initial.revision, repository: "sample/api", compare: true } });
  await waitFor(() => first.document.querySelector("select")?.value === "sample/api", "agent filter update");
  assert.equal(first.document.getElementById("root"), root);
  assert.equal(first.selectedContext().boardId, initial.boardId);
  assert.equal(first.selectedContext().query.compare, true);
  assert.equal(first.document.querySelector('[aria-label="Activity evidence"]'), null);
  assert.deepEqual(first.errors, []);
});

test("setup stays passive and independent boards recover their saved query without opening evidence", async t => {
  const workspace = new Workspace();
  workspace.configured = false;
  workspace.collected = false;
  const empty = await panel(workspace, workspace.open());
  t.after(empty.close);
  await waitFor(() => empty.document.body.textContent?.includes("Choose the repositories to collect") ?? false, "source setup prompt");
  assert.equal(empty.calls.some(call => ["refresh_sources", "configure_sources", "query_evidence"].includes(call.name)), false);
  assert.equal(button(empty.document, "Refresh sources").disabled, true);
  workspace.configured = true;
  workspace.collected = true;
  const initial = workspace.open();
  const other = workspace.open();
  const first = await panel(workspace, initial);
  const second = await panel(workspace, other);
  t.after(first.close);
  t.after(second.close);
  await workspace.tool({ name: "update_board", arguments: { board_id: initial.boardId, expected_revision: initial.revision, repository: "sample/web", days: 14 } });
  await waitFor(() => first.selectedContext()?.query.repository === "sample/web", "first board changed scope");
  assert.equal(second.selectedContext().boardId, other.boardId);
  assert.deepEqual(second.selectedContext().query, other.query);
  const updated = first.selectedContext();
  await first.close();
  const reopened = await panel(workspace, initial);
  t.after(reopened.close);
  await waitFor(() => reopened.selectedContext()?.revision === updated.revision && dailyButtons(reopened.document).length === 14, "reopened latest query");
  assert.equal(reopened.selectedContext().boardId, initial.boardId);
  assert.deepEqual(reopened.selectedContext().query, updated.query);
  assert.equal(reopened.document.querySelector('[aria-label="Activity evidence"]'), null);
  assert.equal(reopened.calls.some(call => call.name === "query_evidence"), false);
  assert.deepEqual([...empty.errors, ...first.errors, ...second.errors, ...reopened.errors], []);
});

test("People can open directly and keep Git and GitHub identities and evidence separate", async t => {
  const workspace = new Workspace();
  const initial = { ...workspace.open(), initialView: "people" as const };
  const first = await panel(workspace, initial);
  t.after(first.close);
  await waitFor(() => first.document.querySelectorAll('[aria-label="People records"] [data-person-id]').length === 2, "Git contributors");
  assert.equal(first.selectedContext().view, "people");
  assert.equal(first.document.querySelector('[aria-label="Daily commits"]'), null);
  assert.equal(first.calls.some(call => call.name === "query_evidence"), false);
  const gitPerson = workspace.people(initial, "git")[0];
  button(first.document, `Select person ${gitPerson.name}: ${gitPerson.identity}`).click();
  await waitFor(() => first.document.querySelector('[aria-label="People evidence"]') !== null && first.document.querySelectorAll('[aria-label="Commit records"] article').length > 0 && first.selectedContext()?.personId === gitPerson.id, "selected Git identity");
  const gitEvidence = first.calls.find(call => call.name === "query_evidence")!.arguments!;
  assert.equal(gitEvidence.person_id, gitPerson.id);
  assert.equal(gitEvidence.bucket_start, undefined);
  assert.equal(first.selectedContext().bucketStart, null);
  assert.ok(first.document.querySelector('[aria-label="Commit records"]')?.textContent?.includes(gitPerson.name));
  assert.ok(!first.document.querySelector('[aria-label="Commit records"]')?.textContent?.includes(gitPerson.name === "Contributor A" ? "Contributor B" : "Contributor A"));
  button(first.document, "Explain selection").click();
  await waitFor(() => first.messages.length === 1, "People explanation");
  assert.match(humanMessage(first.messages[0], first.selectedContext()), /person|people|contributor/i);
  assert.equal(first.selectedContext().personId, gitPerson.id);
  button(first.document, "GitHub authors").click();
  await waitFor(() => first.selectedContext()?.peopleSource === "github" && first.document.querySelectorAll('[aria-label="People records"] [data-person-id]').length === 2, "GitHub authors");
  assert.equal(first.selectedContext().personId, null);
  assert.equal(first.document.querySelector('[aria-label="People evidence"]'), null);
  const githubPerson = workspace.people(initial, "github")[0];
  button(first.document, `Select person ${githubPerson.name}: ${githubPerson.identity}`).click();
  await waitFor(() => first.document.querySelector('[aria-label="People evidence"]') !== null && first.selectedContext()?.personId === githubPerson.id && first.document.querySelector('[aria-label="Person pull requests"]') !== null, "GitHub identity evidence");
  assert.equal(first.document.querySelector('[aria-label="Commit records"]'), null);
  const prEvidence = first.calls.filter(call => call.name === "query_evidence").at(-1)!.arguments!;
  assert.equal(prEvidence.person_id, githubPerson.id);
  assert.equal(prEvidence.pull_request_state, undefined);
  assert.equal(prEvidence.bucket_start, undefined);
  const personLinks = [...first.document.querySelectorAll<HTMLAnchorElement>('[aria-label="Person pull requests"] a')];
  assert.ok(personLinks.length > 0);
  assert.ok(personLinks.every(link => workspace.prs.some(pr => pr.url === link.href && pr.author === githubPerson.identity)));
  button(first.document, "Close people evidence").click();
  await waitFor(() => first.selectedContext()?.personId === null && first.document.querySelector('[aria-label="People evidence"]') === null, "dismissed person selection");
  assert.deepEqual(first.errors, []);
});

test("a late People response cannot replace the newer source or leak its selection", async t => {
  const workspace = new Workspace();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  workspace.delayPeople = args => args.source === "git" ? gate : Promise.resolve();
  const first = await panel(workspace, { ...workspace.open(), initialView: "people" });
  t.after(first.close);
  await waitFor(() => first.calls.some(call => call.name === "query_people" && call.arguments?.source === "git"), "delayed Git people query");
  button(first.document, "GitHub authors").click();
  await waitFor(() => first.document.querySelector('[aria-label="People records"]')?.textContent?.includes("contributor-a") ?? false, "new GitHub people");
  release();
  await waitFor(() => workspace.completedPeople.some(args => args.source === "git"), "late Git people completion");
  assert.equal(first.selectedContext().peopleSource, "github");
  assert.equal(first.selectedContext().personId, null);
  assert.ok(!first.document.querySelector('[aria-label="People records"]')?.textContent?.includes("@example.test"));
  assert.equal(first.calls.some(call => call.name === "query_evidence"), false);
  assert.deepEqual(first.errors, []);
});

test("failed context updates block explanations and rejected messages remain retryable", async t => {
  const workspace = new Workspace();
  const initial = workspace.open();
  const first = await panel(workspace, initial);
  t.after(first.close);
  first.rejectContext(true);
  dailyButtons(first.document)[0].click();
  await waitFor(() => first.document.querySelector('[role="alert"]')?.textContent?.includes("could not be shared") ?? false, "context update failure");
  assert.equal(button(first.document, "Explain selection").disabled, true);
  assert.equal(first.messages.length, 0);
  first.rejectContext(false);
  button(first.document, "Try again").click();
  await waitFor(() => first.selectedContext()?.bucketStart === initial.buckets[0].start && !button(first.document, "Explain selection").disabled, "context sharing recovered");
  first.rejectMessage(true);
  button(first.document, "Explain selection").click();
  await waitFor(() => first.document.querySelector('[role="alert"]')?.textContent?.includes("did not accept") ?? false, "message rejected");
  assert.equal(first.messages.length, 0);
  assert.equal(first.selectedContext().bucketStart, initial.buckets[0].start);
  first.rejectMessage(false);
  button(first.document, "Explain selection").click();
  await waitFor(() => first.messages.length === 1, "explanation retry accepted");
  assert.deepEqual(first.errors, []);
});

test("retry keeps a later-page People selection visible and consistent with shared context", async t => {
  const workspace = new Workspace();
  for (const name of ["C", "D", "E"]) {
    const source = workspace.records[0];
    workspace.records.push({ ...source, id: `sample/api:person-${name}`, subject: `Improve ${name} evidence`, timestamp: "2026-11-16T09:00:00Z", contributor: `Contributor ${name}`, email: `contributor-${name.toLowerCase()}@example.test` });
  }
  const initial = { ...workspace.open(), initialView: "people" as const };
  const first = await panel(workspace, initial);
  t.after(first.close);
  await waitFor(() => first.document.querySelectorAll('[aria-label="People records"] [data-person-id]').length === 3, "first people page");
  button(first.document, "Load more people").click();
  await waitFor(() => first.document.querySelectorAll('[aria-label="People records"] [data-person-id]').length === 5, "later people page");
  const person = workspace.people(initial, "git").at(-1)!;
  button(first.document, `Select person ${person.name}: ${person.identity}`).click();
  await waitFor(() => first.document.querySelector('[aria-label="People evidence"]')?.textContent?.includes(person.identity) === true && first.selectedContext()?.personId === person.id, "later-page person selected");
  first.rejectMessage(true);
  button(first.document, "Explain selection").click();
  await waitFor(() => first.document.querySelector('[role="alert"]') !== null, "explanation rejection");
  first.rejectMessage(false);
  const contextUpdates = first.contexts.length;
  button(first.document, "Try again").click();
  await waitFor(() => first.contexts.length > contextUpdates && first.document.querySelector('[role="alert"]') === null && first.selectedContext()?.personId === person.id, "People retry");
  assert.ok(first.document.querySelector('[aria-label="People evidence"]')?.textContent?.includes(person.identity));
  assert.equal(button(first.document, `Select person ${person.name}: ${person.identity}`).getAttribute("aria-pressed"), "true");
  button(first.document, "Explain selection").click();
  await waitFor(() => first.messages.length === 1, "retried exact person explanation");
  humanMessage(first.messages[0], first.selectedContext());
  assert.equal(first.selectedContext().personId, person.id);
  assert.deepEqual(first.errors, []);
});

test("source refresh progress is visible while collection is pending and finishes honestly with coverage gaps", async t => {
  const workspace = new Workspace();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  workspace.refreshOperation = async () => {
    workspace.refresh = refreshProgress(1, 0);
    await gate;
    workspace.refresh = refreshProgress(2, 1, "complete", "Source refresh completed with coverage gaps.");
  };
  const first = await panel(workspace, workspace.open());
  t.after(async () => { release(); await first.close(); });
  const originalSnapshot = first.selectedContext().snapshotId;
  refreshButton(first.document).click();
  await waitFor(() => first.calls.some(call => call.name === "refresh_sources"), "started source collection");
  assert.equal(refreshButton(first.document).disabled, true);
  await waitFor(() => processed(first.document, "Git") === 1 && processed(first.document, "GitHub") === 0, "in-flight refresh progress");
  assert.equal(refreshSection(first.document)?.getAttribute("role"), "status");
  assert.equal(first.selectedContext().snapshotId, originalSnapshot);
  assert.equal(first.calls.filter(call => call.name === "refresh_sources").length, 1);
  const git = first.document.querySelector<HTMLProgressElement>('progress[aria-label="Git repositories processed"]');
  const github = first.document.querySelector<HTMLProgressElement>('progress[aria-label="GitHub repositories processed"]');
  assert.equal(git?.max, 2);
  assert.equal(github?.max, 2);
  workspace.refresh = refreshProgress(2, 1);
  await waitFor(() => processed(first.document, "Git") === 2 && processed(first.document, "GitHub") === 1, "updated refresh progress before completion");
  assert.equal(refreshButton(first.document).disabled, true);
  release();
  await waitFor(() => refreshSection(first.document)?.textContent?.includes("completed with coverage gaps") === true && !refreshButton(first.document).disabled, "completed refresh with partial coverage");
  assert.equal(refreshSection(first.document)?.querySelector("progress"), null);
  assert.notEqual(first.selectedContext().snapshotId, originalSnapshot);
  assert.equal(first.calls.filter(call => call.name === "refresh_sources").length, 1);
  assert.deepEqual(first.errors, []);
});

test("same-snapshot refresh progress keeps paged Activity evidence while external collection disables refresh", async t => {
  const workspace = new Workspace();
  const initial = workspace.open();
  const first = await panel(workspace, initial);
  t.after(first.close);
  const index = initial.buckets.findIndex(bucket => bucket.commits > 3);
  dailyButtons(first.document)[index].click();
  await waitFor(() => first.document.querySelectorAll('[aria-label="Commit records"] article').length === 3, "Activity selection");
  button(first.document, "Load more evidence").click();
  await waitFor(() => first.document.querySelectorAll('[aria-label="Commit records"] article').length === 6, "paged Activity evidence");
  const originalSnapshot = first.selectedContext().snapshotId;
  const evidenceCalls = first.calls.filter(call => call.name === "query_evidence").length;
  const sourceCalls = first.calls.filter(call => call.name === "refresh_sources").length;
  workspace.refresh = refreshProgress(1, 0);
  await waitFor(() => processed(first.document, "Git") === 1, "external refresh progress");
  assert.equal(refreshButton(first.document).disabled, true);
  assert.equal(refreshButton(first.document).textContent, "Collecting…");
  workspace.refresh = refreshProgress(2, 1);
  await waitFor(() => processed(first.document, "GitHub") === 1, "external progress update");
  assert.equal(first.selectedContext().snapshotId, originalSnapshot);
  assert.equal(first.selectedContext().bucketStart, initial.buckets[index].start);
  assert.equal(first.document.querySelectorAll('[aria-label="Commit records"] article').length, 6);
  assert.equal(first.calls.filter(call => call.name === "query_evidence").length, evidenceCalls);
  workspace.refresh = refreshProgress(2, 1, "cancelled", "Source refresh was cancelled. Previous Git evidence remains available.");
  await waitFor(() => refreshSection(first.document)?.textContent?.includes("was cancelled") === true && !refreshButton(first.document).disabled, "cancelled refresh progress");
  assert.equal(refreshSection(first.document)?.querySelector("progress"), null);
  assert.equal(first.selectedContext().bucketStart, initial.buckets[index].start);
  assert.equal(first.calls.filter(call => call.name === "refresh_sources").length, sourceCalls);
  assert.equal(first.calls.filter(call => call.name === "query_evidence").length, evidenceCalls);
  assert.deepEqual(first.errors, []);
});

test("a failed refresh keeps its terminal progress and allows another explicit attempt", async t => {
  const workspace = new Workspace();
  workspace.refresh = refreshProgress(1, 0, "failed", "Source refresh stopped before all repositories were processed.");
  const first = await panel(workspace, workspace.open());
  t.after(first.close);
  await waitFor(() => refreshSection(first.document)?.textContent?.includes("stopped before all repositories") === true, "failed progress on opening");
  assert.equal(refreshSection(first.document)?.querySelector("progress"), null);
  assert.equal(refreshButton(first.document).disabled, false);
  assert.equal(first.calls.filter(call => call.name === "refresh_sources").length, 0);
  const originalSnapshot = first.selectedContext().snapshotId;
  workspace.refreshFailure = "Source refresh failed. Try again.";
  workspace.refreshOperation = async () => { workspace.refresh = refreshProgress(1, 0, "failed", "Source refresh failed. Previous Git evidence remains available."); };
  refreshButton(first.document).click();
  await waitFor(() => first.document.querySelector('[role="alert"]')?.textContent?.includes("Source refresh failed") === true && refreshSection(first.document)?.textContent?.includes("Previous Git evidence remains available") === true && !refreshButton(first.document).disabled, "failed refresh completion");
  assert.equal(first.selectedContext().snapshotId, originalSnapshot);
  assert.equal(dailyButtons(first.document).length, 7);
  assert.equal(first.calls.filter(call => call.name === "refresh_sources").length, 1);
  workspace.refreshFailure = null;
  workspace.refreshOperation = async () => { workspace.refresh = refreshProgress(2, 2, "complete", "Source refresh completed."); };
  refreshButton(first.document).click();
  await waitFor(() => first.selectedContext().snapshotId !== originalSnapshot && refreshSection(first.document)?.textContent?.includes("Source refresh completed.") === true, "explicit retry after failure");
  assert.equal(first.calls.filter(call => call.name === "refresh_sources").length, 2);
  assert.deepEqual(first.errors, []);
});

test("equal-timestamp progress cannot regress repository or request counters", async t => {
  const workspace = new Workspace();
  workspace.refresh = refreshProgress(2, 1, "running", "Current refresh progress.");
  const first = await panel(workspace, workspace.open());
  t.after(first.close);
  await waitFor(() => processed(first.document, "Git") === 2 && processed(first.document, "GitHub") === 1, "current refresh counters");
  const current = workspace.refresh;
  const delayed = [
    { ...current, git: { ...current.git, completedRepositories: 1 } },
    { ...current, github: { ...current.github, completedRepositories: 0 } },
    { ...current, github: { ...current.github, requests: 2 } },
  ];
  for (const progress of delayed) {
    workspace.refresh = { ...progress, message: "Delayed refresh progress." };
    await first.sendSnapshot(workspace.snapshot(first.selectedContext().boardId));
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(processed(first.document, "Git"), 2);
    assert.equal(processed(first.document, "GitHub"), 1);
    assert.ok(refreshSection(first.document)?.textContent?.includes("Current refresh progress."));
    assert.ok(!refreshSection(first.document)?.textContent?.includes("Delayed refresh progress."));
  }
  assert.equal(first.calls.filter(call => call.name === "refresh_sources").length, 0);
  assert.deepEqual(first.errors, []);
});

test("a delayed pre-refresh board read cannot replace the completed snapshot or a new Activity selection", async t => {
  const workspace = new Workspace();
  const originalTool = workspace.tool.bind(workspace);
  let holdNextRead = false;
  let capturedOldRead = false;
  let returnedOldRead = false;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  workspace.tool = async params => {
    const result = await originalTool(params);
    if (params.name === "read_board" && holdNextRead) {
      holdNextRead = false;
      capturedOldRead = true;
      await gate;
      returnedOldRead = true;
    }
    return result;
  };
  const initial = workspace.open();
  const first = await panel(workspace, initial);
  t.after(async () => { release(); await first.close(); });
  const originalSnapshot = first.selectedContext().snapshotId;
  holdNextRead = true;
  await waitFor(() => capturedOldRead, "held pre-refresh poll response");
  workspace.refreshOperation = async () => { workspace.refresh = refreshProgress(2, 2, "complete", "Source refresh completed."); };
  refreshButton(first.document).click();
  await waitFor(() => first.selectedContext().snapshotId !== originalSnapshot && refreshSection(first.document)?.textContent?.includes("Source refresh completed.") === true, "new collection");
  dailyButtons(first.document)[0].click();
  await waitFor(() => first.selectedContext()?.bucketStart === initial.buckets[0].start && first.calls.some(call => call.name === "query_evidence"), "new Activity selection");
  const completedSnapshot = first.selectedContext().snapshotId;
  const evidenceCalls = first.calls.filter(call => call.name === "query_evidence").length;
  release();
  await waitFor(() => returnedOldRead, "delayed old response delivered");
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(first.selectedContext().snapshotId, completedSnapshot);
  assert.ok(refreshSection(first.document)?.textContent?.includes("Source refresh completed."));
  assert.equal(refreshButton(first.document).disabled, false);
  assert.equal(dailyButtons(first.document)[0].getAttribute("aria-pressed"), "true");
  assert.equal(first.selectedContext().bucketStart, initial.buckets[0].start);
  assert.equal(first.calls.filter(call => call.name === "query_evidence").length, evidenceCalls);
  assert.deepEqual(first.errors, []);
});

test("ordinary navigation updates structured background context without creating chat messages", async t => {
  const workspace = new Workspace();
  const initial = workspace.open();
  const first = await panel(workspace, initial);
  t.after(first.close);
  await waitFor(() => dailyButtons(first.document).length === 7, "initial Activity navigation");
  const bucket = initial.buckets.find(item => item.commits > 0)!;
  dailyButtons(first.document)[initial.buckets.indexOf(bucket)].click();
  await waitFor(() => first.selectedContext()?.bucketStart === bucket.start, "background Activity selection");
  button(first.document, "People").click();
  const person = workspace.people(initial, "git")[0];
  await waitFor(() => first.document.querySelector(`[data-person-id="${person.id}"]`) !== null, "People navigation");
  button(first.document, `Select person ${person.name}: ${person.identity}`).click();
  await waitFor(() => first.selectedContext()?.personId === person.id, "background person selection");
  choose(first.document, "Repository", "sample/api");
  await waitFor(() => first.selectedContext()?.query.repository === "sample/api", "background scope change");
  assert.equal(first.messages.length, 0);
  assert.ok(first.contexts.length >= 5);
  assert.ok(first.contexts.every(context => context.content === undefined && context.structuredContent !== undefined));
  assert.equal(first.selectedContext().boardId, initial.boardId);
  assert.deepEqual(first.errors, []);
});

test("text-only context hosts receive assistant-only background data and human action messages", async t => {
  const workspace = new Workspace();
  const initial = workspace.open();
  const first = await panel(workspace, initial, "text");
  t.after(first.close);
  dailyButtons(first.document)[0].click();
  await waitFor(() => first.selectedContext()?.bucketStart === initial.buckets[0].start, "assistant-only selection fallback");
  assert.equal(first.messages.length, 0);
  for (const context of first.contexts) {
    assert.equal(context.structuredContent, undefined);
    assert.ok(context.content?.length);
    for (const content of context.content ?? []) {
      assert.equal(content.type, "text");
      assert.deepEqual(content.annotations?.audience, ["assistant"]);
    }
  }
  assert.equal(first.selectedContext().snapshotId, initial.snapshotId);
  assert.deepEqual(first.selectedContext().recordIds, initial.buckets[0].recordIds);
  button(first.document, "Explain selection").click();
  await waitFor(() => first.messages.length === 1, "text-only host explanation");
  assert.match(humanMessage(first.messages[0], first.selectedContext()), /activity/i);
  assert.deepEqual(first.errors, []);
});

test("unsupported background context never falls back to posting selection data in chat", async t => {
  const workspace = new Workspace();
  const first = await panel(workspace, workspace.open(), "none");
  t.after(first.close);
  dailyButtons(first.document)[0].click();
  await waitFor(() => first.document.querySelector('[aria-label="Activity evidence"]') !== null && first.document.querySelector('[role="alert"]')?.textContent?.includes("could not be shared") === true, "unavailable context reported");
  assert.equal(button(first.document, "Explain selection").disabled, true);
  button(first.document, "Explain selection").click();
  assert.equal(first.contexts.length, 0);
  assert.equal(first.messages.length, 0);
  assert.deepEqual(first.errors, []);
});

test("choosing People before a restored snapshot arrives preserves the user's view", async t => {
  const workspace = new Workspace();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = await panel(workspace, { ...workspace.open(), initialView: "activity" }, "structured", { waitForInitialContext: false, initialResult: gate });
  t.after(async () => { release(); await first.close(); });
  button(first.document, "People").click();
  release();
  await waitFor(() => first.selectedContext()?.view === "people" && first.document.querySelector('[aria-label="People records"]') !== null, "chosen People view");
  assert.equal(first.calls.some(call => call.name === "refresh_sources"), false);
  assert.deepEqual(first.errors, []);
});
