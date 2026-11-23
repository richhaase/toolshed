import { BoardError } from "../errors";
import { projectEvidence, projectPeople, projectSnapshot, snapshotIdFor, validateQuery, type ProjectedBoard } from "../projection";
import type { BoardQuery, BoardSnapshot, PanelWorkspace, SelectionContext } from "../shared";
import type { BoardBridge, ToolResult } from "./controller";

export interface PanelDataSource {
  embedded(): PanelWorkspace | null;
  reload(): Promise<PanelWorkspace | null>;
}

const STALE_PANEL = "This panel's data is older than the board, and this app does not let the panel reload it. Ask your agent to reopen BigBoard.";

function generationOf(snapshot: BoardSnapshot): number {
  return Number(snapshot.snapshotId.split(":").at(-1));
}

function hostRefused(result: ToolResult): boolean {
  return result.isError === true && result.structuredContent === undefined;
}

export class LocalBoard {
  private query: BoardQuery;

  constructor(private readonly saved: ProjectedBoard, private readonly workspace: PanelWorkspace) {
    this.query = { ...saved.query };
  }

  private snapshot(): BoardSnapshot {
    const unsaved = JSON.stringify(this.query) !== JSON.stringify(this.saved.query);
    const snapshot = projectSnapshot({ ...this.saved, query: this.query }, { ...this.workspace, refresh: null });
    const base = snapshotIdFor(this.saved.boardId, this.saved.revision, this.workspace.generation);
    return unsaved ? { ...snapshot, unsaved, snapshotId: `local:${this.query.days}:${this.query.repository}:${this.query.compare}:${base}` } : snapshot;
  }

  private run(name: string, args: Record<string, unknown>): object {
    const board = this.snapshot();
    const snapshotId = String(args.snapshot_id ?? "");
    const optional = (value: unknown) => typeof value === "string" ? value : undefined;
    if (name === "read_board") return args.known_snapshot_id === board.snapshotId ? { unchanged: true, snapshotId: board.snapshotId, refresh: null } : board;
    if (name === "query_people") return projectPeople(board, this.workspace, snapshotId, optional(args.cursor));
    if (name === "query_evidence") return projectEvidence(board, this.workspace, snapshotId, optional(args.bucket_start), optional(args.cursor), optional(args.person_id));
    if (name === "update_board") {
      const { days, repository, compare } = args;
      const query = validateQuery({ ...this.query, ...(days === undefined ? {} : { days }), ...(repository === undefined ? {} : { repository }), ...(compare === undefined ? {} : { compare }) });
      if (query.repository !== "all" && !this.workspace.configuration.repositories.some(repo => repo.id === query.repository)) throw new BoardError("repository_not_configured", "Choose a repository in this board.");
      this.query = query;
      return this.snapshot();
    }
    throw new BoardError("unavailable", "This app does not let the panel do that. Ask your agent instead.");
  }

  callTool(name: string, args: Record<string, unknown>): ToolResult {
    try { return { structuredContent: this.run(name, args) }; }
    catch (error) {
      const message = error instanceof Error ? error.message : "BigBoard could not complete that request.";
      return { isError: true, content: [{ type: "text", text: message }], structuredContent: { error: { message } } };
    }
  }
}

export class FallbackBridge implements BoardBridge {
  onLocalMode?: () => void;
  private hostAnswered = false;
  private local: LocalBoard | null = null;
  private opened: BoardSnapshot | null = null;

  constructor(private readonly live: BoardBridge, private readonly data: PanelDataSource) {}

  connect(onResult: (result: ToolResult) => void, onTeardown?: () => void): Promise<void> {
    return this.live.connect(result => {
      const snapshot = result.structuredContent as BoardSnapshot | undefined;
      if (!result.isError && typeof snapshot?.snapshotId === "string" && snapshot.query) {
        this.opened = snapshot;
        this.local = null;
      }
      onResult(result);
    }, onTeardown);
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (this.local) return this.local.callTool(name, args);
    if (this.hostAnswered) return this.live.callTool(name, args);
    let failure: unknown;
    try {
      const result = await this.live.callTool(name, args);
      if (!hostRefused(result)) { this.hostAnswered = true; return result; }
      failure = new Error(result.content?.find(item => item.type === "text")?.text ?? "This app did not run the panel's request.");
    } catch (error) { failure = error; }
    if (this.hostAnswered) throw failure;
    if (!this.local) {
      const local = await this.openLocal();
      if (!local) throw failure;
      if (!this.local) { this.local = local; this.onLocalMode?.(); }
    }
    return this.local.callTool(name, args);
  }

  private async openLocal(): Promise<LocalBoard | null> {
    const opened = this.opened;
    if (!opened) return null;
    const current = (workspace: PanelWorkspace | null) => workspace && workspace.generation >= generationOf(opened) ? workspace : null;
    const embedded = this.data.embedded();
    let workspace = current(embedded);
    if (!workspace) {
      try { workspace = current(await this.data.reload()); }
      catch { workspace = null; }
    }
    if (!workspace) {
      if (embedded) throw new BoardError("stale_panel", STALE_PANEL);
      return null;
    }
    const repository = opened.query.repository;
    const known = repository === "all" || workspace.configuration.repositories.some(repo => repo.id === repository);
    return new LocalBoard({ boardId: opened.boardId, revision: opened.revision, updatedAt: opened.updatedAt, query: known ? opened.query : { ...opened.query, repository: "all" } }, workspace);
  }

  updateContext(context: SelectionContext): Promise<void> { return this.live.updateContext(context); }
  sendMessage(text: string): Promise<void> { return this.live.sendMessage(text); }
  close(): Promise<void> { return this.live.close(); }
}
