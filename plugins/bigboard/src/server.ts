import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { BoardError, BoardStore } from "./core";
import { embedPanelData } from "./panel-data";
import { APP_VERSION, BOARD_RESOURCE_URI, type BoardSnapshot, type EvidenceResult, type PeopleResult } from "./shared";
import { BIGBOARD_ICON_DATA_URL } from "./branding";

const boardId = z.string().uuid();
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
function boardText(board: BoardSnapshot): string {
  return `BigBoard ${board.boardId}, revision ${board.revision}, snapshot ${board.snapshotId}. ${board.query.repository}, ` +
    `[${board.scope.since}, ${board.scope.until}) UTC. ${board.totals.commits} recorded non-merge commits. ` +
    `${board.totals.unknownLineCommits} commits have unknown line counts. ${board.initialView ? `Opening ${board.initialView}. ` : ""}${board.coverage.note}` +
    (board.refresh ? ` ${board.refresh.message} Git repositories checked ${board.refresh.git.completedRepositories}/${board.refresh.git.totalRepositories}.` : "");
}
function evidenceText(evidence: EvidenceResult): string {
  return `Commit evidence for board ${evidence.boardId}, snapshot ${evidence.snapshotId}. ` +
    (evidence.selectedPersonId ? `Selected contributor ${evidence.selectedPersonId}. ` : "") +
    (evidence.bucketStart ? `Selected 24-hour interval ${evidence.bucketStart}. ` : "Whole board period. ") +
    `${evidence.records.length}/${evidence.totalRecords} commit records on this page. ` +
    `${evidence.coverage.note}\n${JSON.stringify({ records: evidence.records, nextCursor: evidence.nextCursor })}`;
}
function peopleText(people: PeopleResult): string {
  return `Contributors for board ${people.boardId}, snapshot ${people.snapshotId}. Contributors are grouped by mailmapped author email. ` +
    `${people.people.length}/${people.totalPeople} people on this page. ${people.coverage.note}\n${JSON.stringify({ people: people.people, nextCursor: people.nextCursor })}`;
}
async function result<T extends object>(operation: () => Promise<T>, format: (value: T) => string = JSON.stringify): Promise<CallToolResult> {
  try {
    const value = await operation();
    return { content: [{ type: "text", text: format(value) }], structuredContent: value as Record<string, unknown> };
  } catch (error) {
    const code = error instanceof BoardError ? error.code : "source_error";
    const message = error instanceof BoardError ? error.message : "BigBoard could not complete the operation. Check the configured clone paths and Git availability, then retry.";
    return { isError: true, content: [{ type: "text", text: message }], structuredContent: { error: { code, message } } };
  }
}
function panelHtml(html: string, store: BoardStore): string {
  try { return embedPanelData(html, store.panelWorkspace()); }
  catch { return html; }
}
export function createBigboardServer(html: string, store: BoardStore): McpServer {
  const icons = [{ src: BIGBOARD_ICON_DATA_URL, mimeType: "image/png", sizes: ["1254x1254"] }];
  const server = new McpServer({ name: "bigboard", title: "BigBoard", version: APP_VERSION, icons });
  const resourceMeta = { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true } };
  registerAppResource(server, "BigBoard", BOARD_RESOURCE_URI,
    { description: "Activity and People views for configured repositories", icons, _meta: resourceMeta },
    async () => ({ contents: [{ uri: BOARD_RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: panelHtml(html, store), _meta: resourceMeta }] }));
  registerAppTool(server, "open_board", {
    title: "Open BigBoard", description: "Open Activity or People for configured repositories. Omit board_id for an independent board or provide its exact ID to reopen it. Opening a board does not itself collect data.",
    inputSchema: { board_id: boardId.optional(), view: z.enum(["activity", "people"]).optional() }, annotations: { ...annotations, readOnlyHint: false }, _meta: { ui: { resourceUri: BOARD_RESOURCE_URI, visibility: ["model", "app"] } },
  }, ({ board_id,view }) => result(async () => ({ ...await store.open(board_id), initialView: view ?? "activity" }), boardText));
  server.registerTool("read_board", {
    title: "Read BigBoard", description: "Read the board snapshot and Git collection progress. Pass known_snapshot_id while polling to receive only the current progress when the snapshot matches.",
    inputSchema: { board_id: boardId, known_snapshot_id: z.string().optional() }, annotations, _meta: { ui: { visibility: ["model", "app"] } },
  }, ({ board_id, known_snapshot_id }) => result(() => store.read(board_id, known_snapshot_id), board =>
    "unchanged" in board ? `Snapshot ${board.snapshotId} is current. ${board.refresh?.message ?? ""}`.trimEnd() : boardText(board)));
  server.registerTool("update_board", {
    title: "Update BigBoard view", description: "Change this board's viewing filters and comparison using its latest expected_revision. Repository must be all or an ID in list_sources. Viewing changes never change collected repositories or perform network requests.",
    inputSchema: { board_id: boardId, expected_revision: z.number().int().positive(), days: z.union([z.literal(7),z.literal(14)]).optional(), repository: z.string().min(1).optional(), compare: z.boolean().optional() },
    annotations: { ...annotations, readOnlyHint: false }, _meta: { ui: { visibility: ["model", "app"] } },
  }, ({ board_id,expected_revision,days,repository,compare }) => result(() => store.update(board_id,expected_revision,{ ...(days === undefined ? {} : { days }), ...(repository === undefined ? {} : { repository }), ...(compare === undefined ? {} : { compare }) }), boardText));
  server.registerTool("query_evidence", {
    title: "Inspect BigBoard evidence", description: "Page commits by author date for the selected board snapshot. Optionally filter by a selected 24-hour bucket or a contributor ID from query_people. Reuse nextCursor with the same snapshot and selection.",
    inputSchema: z.strictObject({ board_id: boardId, snapshot_id: z.string(), bucket_start: z.string().optional(), person_id: z.string().min(1).max(8192).optional(), cursor: z.string().optional() }), annotations, _meta: { ui: { visibility: ["model", "app"] } },
  }, ({ board_id, snapshot_id, bucket_start, cursor, person_id }) => result(() => store.evidence(board_id, snapshot_id, bucket_start, cursor, person_id), evidenceText));
  server.registerTool("query_people", {
    title: "Inspect BigBoard people", description: "Page contributors for an exact snapshot. Groups commits and known line counts within the board period by mailmapped author email. Pass a contributor's id as person_id to query_evidence. Reuse nextCursor to read more contributors from the same snapshot.",
    inputSchema: z.strictObject({ board_id: boardId, snapshot_id: z.string(), cursor: z.string().optional() }), annotations, _meta: { ui: { visibility: ["model", "app"] } },
  }, ({ board_id, snapshot_id, cursor }) => result(() => store.people(board_id, snapshot_id, cursor), peopleText));
  server.registerTool("list_sources", {
    title: "List BigBoard sources", description: "Read saved collection selection and its revision. Paths refer to existing local clones, distinct from temporary viewing filters.", inputSchema: {}, annotations,
  }, () => result(async () => store.sources()));
  server.registerTool("configure_sources", {
    title: "Configure BigBoard sources", description: "Save local repository paths, or set import_native:true to copy native BigBoard selected repositories read-only. Provide exactly one of paths or import_native:true. Pass expected_revision from list_sources to avoid overwriting changed settings. Replaces selection and clears old collected data; does not fetch or modify clones.",
    inputSchema: { paths: z.array(z.string().min(1)).max(100).optional(), import_native: z.boolean().optional(), expected_revision: z.number().int().nonnegative().optional() }, annotations: { ...annotations, readOnlyHint: false },
  }, ({ paths,import_native,expected_revision }) => result(() => store.configure(paths,import_native === true,expected_revision)));
  server.registerTool("refresh_sources", {
    title: "Refresh BigBoard sources", description: "Collect 28 days of Git history by author date from the configured clones' local remote-tracking default branches. Saves the collection time and coverage. May take up to 150 seconds. Use read_board or request MCP progress notifications to track the refresh.",
    inputSchema: {}, annotations: { ...annotations, readOnlyHint: false }, _meta: { ui: { visibility: ["model", "app"] } },
  }, (_,extra) => {
    let lastProgress = -1;
    return result(() => store.refresh(extra.signal, progress => {
      const progressToken = extra._meta?.progressToken;
      const completed = progress.git.completedRepositories;
      if (progressToken === undefined || completed <= lastProgress) return;
      lastProgress = completed;
      void extra.sendNotification({ method: "notifications/progress", params: { progressToken, progress: completed, total: progress.git.totalRepositories, message: `${progress.message} Git repositories checked ${completed}/${progress.git.totalRepositories}.` } }).catch(() => {});
    }));
  });
  return server;
}
