import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { AppBridge } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { JSDOM, VirtualConsole } from "jsdom";
import { BoardStore } from "../src/core";
import { embedPanelData, MAX_PANEL_DATA_LENGTH, panelDataFromHtml } from "../src/panel-data";
import { BOARD_RESOURCE_URI, PERIOD_DAYS, type ActivityRecord, type BoardSnapshot, type ConfiguredRepository, type EvidenceResult, type PanelWorkspace, type PeopleResult, type SelectionContext } from "../src/shared";
import { FallbackBridge, LocalBoard } from "../src/ui/fallback";
import type { BoardBridge, ToolResult } from "../src/ui/controller";

const DAY = 86_400_000;
const NOW = new Date("2026-11-17T12:00:00.000Z");
const repos: ConfiguredRepository[] = ["example/widget", "example/other"].map(id => ({ id, path: `/private/clones/${id}`, remote: "origin", defaultBranch: "main" }));
const shell = () => readFile(new URL("../bundle/board.html", import.meta.url), "utf8");

function records(repository: string, offset: number): ActivityRecord[] {
  return Array.from({ length: 60 }, (_, index) => {
    const sha = (offset + index).toString(16).padStart(40, "0");
    return {
      id: `${repository}@${sha}`, repository, sha, timestamp: new Date(NOW.getTime() - ((index * (offset + 3)) % 28 + 0.4) * DAY).toISOString(),
      subject: index === 0 ? "Close </script><b> safely & $&  " : `Change ${index}`, contributor: `Contributor ${(offset + index) % 47}`, email: index % 11 === 0 ? "" : `person-${(offset + index) % 47}@example.invalid`,
      additions: index === 5 ? null : index, deletions: index === 5 ? null : 1, files: [{ path: "private/path.txt", additions: 1, deletions: 1 }], url: `https://github.com/${repository}/commit/${sha}`,
    };
  });
}

async function collected(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "bigboard-fallback-"));
  const store = new BoardStore(directory, {
    now: () => NOW,
    describeRepository: async path => repos.find(repo => repo.path === path)!,
    collectGitHistory: async repository => ({ repository, revision: "a".repeat(40), ref: "refs/remotes/origin/main", shallow: false, partial: false, complete: true, linesComplete: true, records: records(repository.id, repository === repos[0] ? 0 : 500), error: null }),
  });
  t.after(async () => { store.close(); await rm(directory, { recursive: true, force: true }); });
  await store.configure(repos.map(repo => repo.path), false);
  await store.refresh();
  return store;
}

async function waitFor(predicate: () => boolean, description: string): Promise<void> {
  const deadline = Date.now() + 6000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${description}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

const comparable = (snapshot: BoardSnapshot) => ({ ...snapshot, snapshotId: null, revision: null, updatedAt: null, refresh: null, unsaved: undefined });
const structured = <T>(result: ToolResult): T => { assert.notEqual(result.isError, true, JSON.stringify(result.content)); return result.structuredContent as T; };

test("local projections match the server for every filter, page, person and interval", async t => {
  const store = await collected(t);
  const opened = await store.open();
  const local = new LocalBoard(opened, store.panelWorkspace());
  let revision = opened.revision;
  for (const days of PERIOD_DAYS) for (const repository of ["all", repos[0].id]) for (const compare of [false, true]) {
    const server = await store.update(opened.boardId, revision, { days, repository, compare });
    revision = server.revision;
    const panel = structured<BoardSnapshot>(local.callTool("update_board", { expected_revision: 1, days, repository, compare }));
    assert.deepEqual(comparable(panel), comparable(server));
    let serverCursor: string | undefined, panelCursor: string | undefined;
    do {
      const expected: PeopleResult = await store.people(opened.boardId, server.snapshotId, serverCursor);
      const actual = structured<PeopleResult>(local.callTool("query_people", { snapshot_id: panel.snapshotId, ...(panelCursor ? { cursor: panelCursor } : {}) }));
      assert.deepEqual(actual.people, expected.people);
      assert.equal(actual.nextCursor === null, expected.nextCursor === null);
      if (compare) assert.ok(actual.people.every(person => typeof person.previousCommits === "number"));
      serverCursor = expected.nextCursor ?? undefined; panelCursor = actual.nextCursor ?? undefined;
    } while (serverCursor);
    for (const selection of [{}, { bucket_start: (server.buckets.find(bucket => bucket.commits) ?? server.buckets[0]).start }]) {
      const expected = await store.evidence(opened.boardId, server.snapshotId, selection.bucket_start);
      const actual = structured<EvidenceResult>(local.callTool("query_evidence", { snapshot_id: panel.snapshotId, ...selection }));
      assert.equal(actual.totalRecords, expected.totalRecords);
      assert.deepEqual(actual.records.map(record => record.id), expected.records.map(record => record.id));
    }
  }
});

test("an unsaved local view never reuses a saved snapshot identity", async t => {
  const store = await collected(t);
  const opened = await store.open();
  const local = new LocalBoard(opened, store.panelWorkspace());
  assert.equal(structured<BoardSnapshot>(local.callTool("read_board", {})).snapshotId, opened.snapshotId);
  const changed = structured<BoardSnapshot>(local.callTool("update_board", { days: 14 }));
  assert.equal(changed.unsaved, true);
  assert.notEqual(changed.snapshotId, opened.snapshotId);
  assert.equal(local.callTool("query_people", { snapshot_id: opened.snapshotId }).isError, true);
  assert.equal(local.callTool("update_board", { repository: "example/missing" }).isError, true);
  assert.equal(local.callTool("refresh_sources", {}).isError, true);
  assert.equal(structured<BoardSnapshot>(local.callTool("update_board", { days: 7 })).snapshotId, opened.snapshotId);
});

test("embedded data escapes markup, omits clone paths and file lists, and respects the size limit", async t => {
  const store = await collected(t);
  const workspace = store.panelWorkspace();
  const html = embedPanelData(await shell(), workspace);
  assert.deepEqual(panelDataFromHtml(html), JSON.parse(JSON.stringify(workspace)));
  const embedded = html.slice(html.indexOf('id="bigboard-data">'), html.indexOf("</script>"));
  assert.doesNotMatch(embedded, /private\/clones|private\/path/);
  const huge = { ...workspace, collection: { ...workspace.collection!, id: "x".repeat(MAX_PANEL_DATA_LENGTH) } };
  assert.equal(panelDataFromHtml(embedPanelData(await shell(), huge)), null);
  assert.equal(panelDataFromHtml(embedPanelData(await shell(), { generation: 0, configuration: { revision: 0, repositories: [] }, collection: null })), null);
});

test("oversized panel history keeps the most recent days that fit and says so", async t => {
  const store = await collected(t);
  const workspace = store.panelWorkspace();
  const full = embedPanelData(await shell(), workspace).length;
  const trimmed = panelDataFromHtml(embedPanelData(await shell(), workspace, full - (await shell()).length - 200))!;
  assert.equal(trimmed.trimmed, true);
  assert.ok(trimmed.collection!.since > workspace.collection!.since);
  const opened = await store.open();
  const local = new LocalBoard(opened, trimmed);
  const wide = structured<BoardSnapshot>(local.callTool("update_board", { days: 90 }));
  assert.equal(wide.historyStart, trimmed.collection!.since);
  assert.equal(wide.configuration.needsRefresh, false);
  assert.match(wide.coverage.note, /Ask your agent for earlier commits/);
});

function bridgeFor(opened: BoardSnapshot, call: BoardBridge["callTool"]): BoardBridge {
  return { connect: async onResult => onResult({ structuredContent: opened }), callTool: call, updateContext: async () => {}, sendMessage: async () => {}, close: async () => {} };
}

test("only a host that has never answered falls back to local data", async t => {
  const store = await collected(t);
  const opened = await store.open();
  const workspace = store.panelWorkspace();
  const data = { embedded: () => workspace, reload: async () => null };
  const read = { board_id: opened.boardId };
  for (const refuse of [async () => { throw new Error("MCP error -32601: Method not found"); }, async () => ({ isError: true, content: [{ type: "text", text: "This tool isn't available right now." }] })]) {
    const bridge = new FallbackBridge(bridgeFor(opened, refuse), data);
    let announced = 0;
    bridge.onLocalMode = () => { announced += 1; };
    await bridge.connect(() => {});
    const results = await Promise.all([bridge.callTool("read_board", read), bridge.callTool("query_people", { snapshot_id: opened.snapshotId })]);
    assert.ok(results.every(result => !result.isError));
    assert.equal(announced, 1);
  }
  let healthy = true;
  const bridge = new FallbackBridge(bridgeFor(opened, async () => { if (!healthy) throw new Error("offline"); return { structuredContent: opened }; }), data);
  await bridge.connect(() => {});
  await bridge.callTool("read_board", read);
  healthy = false;
  await assert.rejects(bridge.callTool("read_board", read), /offline/);
  const toolError = { isError: true, content: [], structuredContent: { error: { code: "stale_snapshot", message: "Read again." } } };
  const answered = new FallbackBridge(bridgeFor(opened, async () => toolError), data);
  await answered.connect(() => {});
  assert.deepEqual(await answered.callTool("query_people", {}), toolError);
});

test("a stale panel reloads newer data and otherwise explains how to reopen", async t => {
  const store = await collected(t);
  const stale = store.panelWorkspace();
  await store.refresh();
  const opened = await store.open();
  const refuse = async (): Promise<ToolResult> => { throw new Error("MCP error -32601: Method not found"); };
  const reloading = new FallbackBridge(bridgeFor(opened, refuse), { embedded: () => stale, reload: async () => store.panelWorkspace() });
  await reloading.connect(() => {});
  assert.equal(structured<BoardSnapshot>(await reloading.callTool("read_board", {})).snapshotId, opened.snapshotId);
  for (const reload of [async () => stale, async () => { throw new Error("unavailable"); }]) {
    const blocked = new FallbackBridge(bridgeFor(opened, refuse), { embedded: () => stale, reload });
    await blocked.connect(() => {});
    await assert.rejects(blocked.callTool("read_board", {}), /reopen BigBoard/);
  }
  const absent = new FallbackBridge(bridgeFor(opened, refuse), { embedded: () => null, reload: async () => null });
  await absent.connect(() => {});
  await assert.rejects(absent.callTool("read_board", {}), /Method not found/);
});

async function refusingPanel(html: string, opened: BoardSnapshot, resource: () => Promise<string>) {
  const host = new JSDOM("<!doctype html><body></body>");
  const contexts: SelectionContext[] = [];
  const messages: string[] = [];
  const errors: string[] = [];
  let guest: JSDOM | undefined;
  let closed = false;
  const transport: Transport = {
    async start() {}, async close() { transport.onclose?.(); },
    async send(message: JSONRPCMessage) { queueMicrotask(() => { if (guest && !closed) guest.window.dispatchEvent(new guest.window.MessageEvent("message", { data: structuredClone(message), source: host.window as unknown as MessageEventSource })); }); },
  };
  host.window.postMessage = ((message: unknown) => { queueMicrotask(() => { if (!closed) transport.onmessage?.(structuredClone(message) as JSONRPCMessage); }); }) as typeof host.window.postMessage;
  const bridge = new AppBridge(null, { name: "Display-only host", version: "1.0.0" }, { serverResources: {}, updateModelContext: { text: {} }, message: { text: {} } });
  bridge.onreadresource = async () => ({ contents: [{ uri: BOARD_RESOURCE_URI, mimeType: "text/html;profile=mcp-app", text: await resource() }] });
  bridge.onupdatemodelcontext = async params => {
    const text = params.content?.filter(item => item.type === "text").map(item => item.text).join("") ?? "";
    contexts.push(JSON.parse(text.slice(text.indexOf("{"))));
    return {};
  };
  bridge.onmessage = async params => { messages.push(params.content.map(item => item.type === "text" ? item.text : "").join("")); return {}; };
  bridge.oninitialized = () => { void bridge.sendToolInput({ arguments: {} }).then(() => bridge.sendToolResult({ content: [], structuredContent: { ...opened, initialView: "activity" } })); };
  await bridge.connect(transport);
  guest = new JSDOM(html, { url: "https://bigboard.test/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: new VirtualConsole(), beforeParse(window) {
    Object.defineProperty(window, "parent", { value: host.window });
    Object.defineProperty(window, "structuredClone", { value: structuredClone });
    for (const name of ["TextEncoder", "TextDecoder"] as const) Object.defineProperty(window, name, { value: globalThis[name] });
    Object.defineProperty(window, "ResizeObserver", { value: class { observe() {} unobserve() {} disconnect() {} } });
    window.addEventListener("error", event => errors.push(String(event.error ?? event.message)));
  } });
  const document = guest.window.document;
  const click = (label: string) => {
    const found = [...document.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent?.trim() === label);
    assert.ok(found, `Missing ${label}`);
    found.click();
  };
  const close = async () => { guest!.window.dispatchEvent(new guest!.window.Event("pagehide")); closed = true; await bridge.close(); guest!.window.close(); host.window.close(); };
  return { document, window: guest.window, contexts, messages, errors, click, close };
}

test("the built panel stays interactive and shares its view in a host that refuses tool calls", async t => {
  const store = await collected(t);
  const opened = await store.open();
  const html = embedPanelData(await shell(), store.panelWorkspace());
  const panel = await refusingPanel(html, opened, async () => html);
  t.after(panel.close);
  const { document } = panel;
  await waitFor(() => document.querySelector(".local-mode") !== null, "local mode");
  assert.equal(document.querySelector('[role="alert"]'), null);
  for (const [label, count, chart] of [["24 hours", 24, "Hourly commits"], ["30 days", 30, "Daily commits"], ["90 days", 13, "Weekly commits"], ["14 days", 14, "Daily commits"]] as const) {
    panel.click(label);
    await waitFor(() => document.querySelectorAll(".day-column").length === count, label);
    assert.ok(document.querySelector(`[aria-label="${chart}"]`));
  }
  document.querySelector<HTMLInputElement>(".compare-control input")!.click();
  await waitFor(() => document.querySelector(".comparison-total") !== null, "comparison");
  const expected = await store.update(opened.boardId, opened.revision, { days: 14, compare: true });
  assert.equal(document.querySelector(".primary-total strong")!.textContent, String(expected.totals.commits));
  assert.ok(document.querySelectorAll('[aria-label="Highlights"] button').length >= 2);
  const bar = [...document.querySelectorAll<HTMLButtonElement>(".day-column")].find(item => item.querySelector(".column-count")!.textContent !== "0")!;
  bar.click();
  await waitFor(() => document.querySelectorAll('[aria-label="Commit records"] article').length > 0, "interval commits");
  await waitFor(() => Boolean(panel.contexts.at(-1)?.bucketStart), "shared interval");
  const context = panel.contexts.at(-1)!;
  assert.equal(context.unsaved, true);
  assert.deepEqual(context.query, { days: 14, repository: "all", compare: true });
  assert.equal(context.summary?.commits, expected.totals.commits);
  assert.equal(context.summary?.previousCommits, expected.totals.previousCommits);
  panel.click("People");
  await waitFor(() => document.querySelectorAll(".person-row").length === 25, "leaderboard");
  assert.equal(document.querySelector(".person-rank")!.textContent, "1");
  assert.match(document.querySelector(".person-numbers")!.textContent!, /% of commits · .*vs previous/);
  await waitFor(() => (panel.contexts.at(-1)?.summary?.people.length ?? 0) === 5, "shared leaderboard");
  panel.click("Load more people");
  await waitFor(() => document.querySelectorAll(".person-row").length > 25, "more people");
  document.querySelector<HTMLButtonElement>(".person-row")!.click();
  await waitFor(() => document.querySelectorAll('[aria-label="Commit records"] article').length > 0, "person commits");
  await waitFor(() => document.querySelector<HTMLButtonElement>(".explain-button")?.disabled === false, "shared person");
  panel.click("Explain selection");
  await waitFor(() => panel.messages.length === 1, "explanation");
  panel.click("Ask to refresh");
  await waitFor(() => panel.messages.length === 2, "refresh request");
  assert.match(panel.messages[1], /refresh/i);
  assert.equal(document.querySelector('[role="alert"]'), null);
  assert.deepEqual(panel.errors, []);
});

test("the built panel replaces cached data by rereading its own page", async t => {
  const store = await collected(t);
  const cached = embedPanelData(await shell(), store.panelWorkspace());
  await store.refresh();
  const opened = await store.open();
  const panel = await refusingPanel(cached, opened, async () => embedPanelData(await shell(), store.panelWorkspace()));
  t.after(panel.close);
  await waitFor(() => panel.document.querySelector(".local-mode") !== null, "reloaded local mode");
  panel.click("14 days");
  await waitFor(() => panel.document.querySelectorAll(".day-column").length === 14, "14 days from reloaded data");
  assert.deepEqual(panel.errors, []);
});
