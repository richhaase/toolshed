import type { ActivityRecord, BoardQuery, BoardSnapshot, BoardUnchanged, BoardViewMode, EvidenceResult, PeopleResult, PersonSummary, SelectionContext } from "../shared";

export type { BoardViewMode } from "../shared";

export interface ToolResult {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
}

export interface BoardBridge {
  connect(onResult: (result: ToolResult) => void, onTeardown?: () => void): Promise<void>;
  callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  updateContext(context: SelectionContext): Promise<void>;
  sendMessage(text: string): Promise<void>;
  close(): Promise<void>;
}

export interface BoardViewState {
  snapshot: BoardSnapshot | null;
  view: BoardViewMode;
  selectedBucket: string | null;
  selectedPersonId: string | null;
  people: PersonSummary[];
  totalPeople: number;
  peopleNextCursor: string | null;
  peopleLoading: boolean;
  records: ActivityRecord[];
  totalRecords: number;
  nextCursor: string | null;
  phase: "connecting" | "waiting" | "ready";
  busy: boolean;
  sourceRefreshing: boolean;
  sourceRefreshPreviousId: string | null;
  evidenceLoading: boolean;
  contextReady: boolean;
  contextFailed: boolean;
  error: string | null;
  notice: string | null;
}

export function selectionContext(snapshot: BoardSnapshot, bucketStart: string | null, view: BoardViewMode = "activity"): SelectionContext {
  const bucket = view === "activity" ? snapshot.buckets.find((item) => item.start === bucketStart) : undefined;
  return {
    boardId: snapshot.boardId,
    revision: snapshot.revision,
    snapshotId: snapshot.snapshotId,
    query: snapshot.query,
    scope: snapshot.scope,
    view,
    bucketStart: bucket?.start ?? null,
    recordIds: bucket?.recordIds.slice(0, 100) ?? [],
    recordIdsTruncated: bucket?.recordIdsTruncated === true || (bucket?.recordIds.length ?? 0) > 100,
  };
}

function toolError(result: ToolResult): void {
  if (result.isError) throw new Error(result.content?.find((item) => item.type === "text")?.text ?? "BigBoard could not complete the request.");
}

export function snapshotFromResult(result: ToolResult): BoardSnapshot {
  toolError(result);
  const value = result.structuredContent as BoardSnapshot | undefined;
  if (!value || typeof value.boardId !== "string" || typeof value.revision !== "number" ||
      typeof value.snapshotId !== "string" || !Array.isArray(value.buckets) || !value.query ||
      !value.scope || !value.coverage || !value.totals || !value.configuration) {
    throw new Error("BigBoard returned an unreadable board. Reopen it from the conversation.");
  }
  return value;
}

export class BoardController {
  private state: BoardViewState = {
    snapshot: null, view: "activity", selectedBucket: null,
    selectedPersonId: null, people: [], totalPeople: 0, peopleNextCursor: null, peopleLoading: false,
    records: [], totalRecords: 0, nextCursor: null,
    phase: "connecting", busy: false, sourceRefreshing: false, sourceRefreshPreviousId: null, evidenceLoading: false,
    contextReady: false, contextFailed: false, error: null, notice: null,
  };
  private listeners = new Set<() => void>();
  private connected = false;
  private viewReady = false;
  private viewChosen = false;
  private destroyed = false;
  private syncing = false;
  private boardReadSequence = 0;
  private evidenceSequence = 0;
  private peopleSequence = 0;
  private contextSequence = 0;
  private contextQueue: Promise<void> = Promise.resolve();
  private poll: ReturnType<typeof setInterval> | null = null;
  private refreshError: string | null = null;

  constructor(private bridge: BoardBridge, private pollMilliseconds = 2000) {}

  getState = (): BoardViewState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(patch: Partial<BoardViewState>): void {
    if (this.destroyed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private clearEvidence(patch: Partial<BoardViewState> = {}): void {
    this.evidenceSequence += 1;
    this.setState({ records: [], totalRecords: 0, nextCursor: null, evidenceLoading: false, ...patch });
  }

  private clearPeople(): void {
    this.peopleSequence += 1;
    this.setState({ people: [], totalPeople: 0, peopleNextCursor: null, peopleLoading: false, selectedPersonId: null });
  }

  private context(): SelectionContext | null {
    const snapshot = this.state.snapshot;
    if (!snapshot) return null;
    return {
      ...selectionContext(snapshot, this.state.selectedBucket, this.state.view),
      ...(this.state.view === "people" ? { personId: this.state.selectedPersonId } : {}),
    };
  }

  async start(): Promise<void> {
    try {
      await this.bridge.connect((result) => {
        try { this.acceptSnapshot(snapshotFromResult(result)); }
        catch (error) { this.setState({ error: this.errorMessage(error) }); }
      }, () => { void this.destroy(false); });
      if (this.destroyed) return;
      this.connected = true;
      if (this.state.snapshot) {
        await this.refresh();
        if (this.destroyed) return;
        this.viewReady = true;
        void this.activateView();
      } else {
        this.viewReady = true;
        this.setState({ phase: "waiting" });
      }
      if (this.pollMilliseconds > 0) {
        this.poll = setInterval(() => {
          if (typeof document === "undefined" || document.visibilityState !== "hidden") void this.refresh(this.state.snapshot?.snapshotId);
        }, this.pollMilliseconds);
      }
    } catch {
      this.setState({ error: "BigBoard could not connect to this conversation. Reopen the board to try again." });
    }
  }

  acceptSnapshot(snapshot: BoardSnapshot): void {
    if (this.destroyed) return;
    const previous = this.state.snapshot;
    if (previous && (previous.boardId !== snapshot.boardId || snapshot.revision < previous.revision)) return;
    if (previous?.refresh && snapshot.refresh) {
      const prior = previous.refresh;
      const incoming = snapshot.refresh;
      if (incoming.startedAt < prior.startedAt || (incoming.id === prior.id &&
          (incoming.updatedAt < prior.updatedAt || (prior.status !== "running" && incoming.status === "running") ||
          incoming.git.completedRepositories < prior.git.completedRepositories))) return;
    }
    const openingView = snapshot.initialView === "activity" || snapshot.initialView === "people" ? snapshot.initialView : undefined;
    const view = !previous && this.viewChosen ? this.state.view : openingView ?? this.state.view;
    if (previous?.snapshotId === snapshot.snapshotId) {
      if (snapshot.refresh && JSON.stringify(previous.refresh) !== JSON.stringify(snapshot.refresh)) this.setState({ snapshot });
      if (view !== this.state.view) void this.setView(view);
      return;
    }
    const selectedBucket = snapshot.buckets.some((bucket) => bucket.start === this.state.selectedBucket) ? this.state.selectedBucket : null;
    this.clearPeople();
    this.clearEvidence({ snapshot, view, selectedBucket, phase: "ready", contextReady: false, contextFailed: false });
    void this.activateView();
  }

  private async activateView(): Promise<void> {
    if (!this.connected || !this.viewReady || this.destroyed) return;
    await Promise.all([this.loadView(), this.shareSelection()]);
  }

  async refresh(knownSnapshotId?: string): Promise<void> {
    const snapshot = this.state.snapshot;
    if (!this.connected || !snapshot || this.syncing || this.destroyed) return;
    this.syncing = true;
    try {
      await this.readLatestBoard(snapshot.boardId, knownSnapshotId);
      if (this.refreshError !== null && this.state.error === this.refreshError) this.setState({ error: null });
      this.refreshError = null;
    } catch {
      this.refreshError = "The board could not refresh. Your last view is still here. Try again.";
      this.setState({ error: this.refreshError });
    } finally {
      this.syncing = false;
    }
  }

  private async readLatestBoard(boardId: string, knownSnapshotId?: string): Promise<void> {
    const sequence = ++this.boardReadSequence;
    try {
      const result = await this.bridge.callTool("read_board", { board_id: boardId, ...(knownSnapshotId ? { known_snapshot_id: knownSnapshotId } : {}) });
      if (sequence !== this.boardReadSequence || this.destroyed) return;
      const current = this.state.snapshot;
      if (knownSnapshotId && knownSnapshotId !== current?.snapshotId) return;
      const update = result.structuredContent as BoardUnchanged | undefined;
      if (!result.isError && update?.unchanged === true) {
        if (!current || update.snapshotId !== knownSnapshotId) throw new Error("BigBoard returned an unexpected snapshot.");
        this.acceptSnapshot({ ...current, initialView: undefined, refresh: update.refresh });
      } else {
        this.acceptSnapshot(snapshotFromResult(result));
      }
    } catch (error) {
      if (sequence === this.boardReadSequence && !this.destroyed) throw error;
    }
  }

  async refreshSources(): Promise<void> {
    if (!this.connected || this.state.busy || this.destroyed || this.state.snapshot?.refresh?.status === "running") return;
    this.boardReadSequence += 1;
    this.setState({ busy: true, sourceRefreshing: true, sourceRefreshPreviousId: this.state.snapshot?.refresh?.id ?? null, error: null, notice: null });
    try {
      toolError(await this.bridge.callTool("refresh_sources", {}));
      const snapshot = this.state.snapshot;
      if (snapshot) await this.readLatestBoard(snapshot.boardId);
      this.setState({ notice: this.state.snapshot?.refresh ? null : "Sources refreshed." });
    } catch (error) {
      this.setState({ error: this.errorMessage(error) });
      const snapshot = this.state.snapshot;
      if (snapshot) {
        try { await this.readLatestBoard(snapshot.boardId); }
        catch {}
      }
    } finally {
      this.setState({ busy: false, sourceRefreshing: false });
    }
  }

  async retry(): Promise<void> {
    this.setState({ error: null, notice: null });
    if (!this.connected) { await this.start(); return; }
    await this.refresh();
    if (this.state.snapshot) {
      if (this.state.view === "people" && this.state.people.length) {
        if (this.state.peopleNextCursor) await this.loadPeople(true);
        await this.loadEvidence();
      } else await this.loadView();
      await this.shareSelection();
    }
  }

  async changeQuery(patch: Partial<BoardQuery>): Promise<void> {
    const snapshot = this.state.snapshot;
    if (!snapshot || this.state.busy || !this.connected) return;
    this.setState({ busy: true, error: null, notice: null });
    try {
      this.acceptSnapshot(snapshotFromResult(await this.bridge.callTool("update_board", { board_id: snapshot.boardId, expected_revision: snapshot.revision, ...patch })));
    } catch (error) {
      this.setState({ error: this.errorMessage(error) });
      await this.refresh();
    } finally { this.setState({ busy: false }); }
  }

  async setView(view: BoardViewMode): Promise<void> {
    if (this.destroyed) return;
    this.viewChosen = true;
    if (view === this.state.view) return;
    this.clearPeople();
    this.clearEvidence({ view, contextReady: false, contextFailed: false, error: null, notice: null });
    await this.activateView();
  }

  async selectBucket(start: string | null): Promise<void> {
    const snapshot = this.state.snapshot;
    if (!snapshot || this.state.view !== "activity" || (start && !snapshot.buckets.some((bucket) => bucket.start === start))) return;
    this.clearEvidence({ selectedBucket: start, contextReady: false, contextFailed: false, error: null, notice: null });
    await Promise.all([this.loadEvidence(), this.shareSelection()]);
  }

  async selectPerson(id: string | null): Promise<void> {
    if (this.state.view !== "people" || (id && !this.state.people.some(person => person.id === id))) return;
    this.clearEvidence({ selectedPersonId: id, contextReady: false, contextFailed: false, error: null, notice: null });
    await Promise.all([this.loadEvidence(), this.shareSelection()]);
  }

  async loadMore(): Promise<void> {
    if (!this.state.nextCursor || this.state.evidenceLoading) return;
    await this.loadEvidence(true);
  }

  async loadMorePeople(): Promise<void> {
    if (!this.state.peopleNextCursor || this.state.peopleLoading) return;
    await this.loadPeople(true);
  }

  private async loadView(): Promise<void> {
    await Promise.all([this.loadPeople(), this.loadEvidence()]);
  }

  private async loadPeople(append = false): Promise<void> {
    const snapshot = this.state.snapshot;
    if (this.state.view !== "people" || !snapshot || !this.connected || this.destroyed || !snapshot.collectedAt || !snapshot.configuration.repositories.length) return;
    const cursor = append ? this.state.peopleNextCursor : null;
    const sequence = ++this.peopleSequence;
    this.setState({ peopleLoading: true });
    try {
      const result = await this.bridge.callTool("query_people", { board_id: snapshot.boardId, snapshot_id: snapshot.snapshotId, ...(cursor ? { cursor } : {}) });
      if (sequence !== this.peopleSequence || this.destroyed) return;
      toolError(result);
      const people = result.structuredContent as PeopleResult | undefined;
      if (people?.snapshotId !== snapshot.snapshotId || !Array.isArray(people.people)) throw new Error("The people view changed. Refresh the board and try again.");
      const rows = append ? [...this.state.people, ...people.people] : people.people;
      this.setState({ people: [...new Map(rows.map(person => [person.id, person])).values()], totalPeople: people.totalPeople, peopleNextCursor: people.nextCursor, peopleLoading: false });
    } catch (error) {
      if (sequence === this.peopleSequence) this.setState({ error: this.errorMessage(error), peopleLoading: false });
    }
  }

  private async loadEvidence(append = false): Promise<void> {
    const snapshot = this.state.snapshot;
    const view = this.state.view;
    const bucketStart = view === "activity" ? this.state.selectedBucket : null;
    const personId = view === "people" ? this.state.selectedPersonId : null;
    if (!snapshot || !this.connected || this.destroyed || !snapshot.collectedAt || !snapshot.configuration.repositories.length || (!bucketStart && !personId)) return;
    const cursor = append ? this.state.nextCursor : null;
    const sequence = ++this.evidenceSequence;
    this.setState({ evidenceLoading: true });
    try {
      const result = await this.bridge.callTool("query_evidence", {
        board_id: snapshot.boardId, snapshot_id: snapshot.snapshotId,
        ...(bucketStart ? { bucket_start: bucketStart } : {}),
        ...(personId ? { person_id: personId } : {}),
        ...(cursor ? { cursor } : {}),
      });
      if (sequence !== this.evidenceSequence || this.destroyed) return;
      toolError(result);
      const evidence = result.structuredContent as EvidenceResult | undefined;
      if (evidence?.snapshotId !== snapshot.snapshotId || !Array.isArray(evidence.records) ||
          (personId && evidence.selectedPersonId !== undefined && evidence.selectedPersonId !== personId)) throw new Error("The selected evidence changed. Refresh the board and select it again.");
      const records = append ? [...this.state.records, ...evidence.records] : evidence.records;
      this.setState({ records: [...new Map(records.map(record => [record.id, record])).values()], totalRecords: evidence.totalRecords, nextCursor: evidence.nextCursor, evidenceLoading: false });
    } catch (error) {
      if (sequence === this.evidenceSequence) this.setState({ error: this.errorMessage(error), evidenceLoading: false });
    }
  }

  private shareSelection(): Promise<void> {
    const context = this.context();
    if (!context || !this.connected) return Promise.resolve();
    const sequence = ++this.contextSequence;
    this.contextQueue = this.contextQueue.catch(() => {}).then(async () => {
      if (this.destroyed || sequence !== this.contextSequence) return;
      try {
        await this.bridge.updateContext(context);
        if (sequence === this.contextSequence) this.setState({ contextReady: true, contextFailed: false });
      } catch {
        if (sequence === this.contextSequence) this.setState({ contextReady: false, contextFailed: true, error: "The selection could not be shared with the conversation. Try again." });
      }
    });
    return this.contextQueue;
  }

  private async sendSelection(context: SelectionContext, message: string): Promise<void> {
    this.setState({ busy: true, error: null, notice: null });
    try {
      await this.shareSelection();
      if (JSON.stringify(this.context()) !== JSON.stringify(context)) throw new Error("The view changed. Select the evidence you want to discuss and try again.");
      if (!this.state.contextReady || this.state.contextFailed) throw new Error("The selection could not be shared with the conversation. Try again.");
      await this.bridge.sendMessage(message);
      this.setState({ notice: "Selection sent to the conversation.", error: null });
    } catch (error) { this.setState({ error: this.errorMessage(error) }); }
    finally { this.setState({ busy: false }); }
  }

  async explainSelection(): Promise<void> {
    const context = this.context();
    const selected = this.state.view === "activity" ? this.state.selectedBucket : this.state.selectedPersonId;
    if (!context || !selected || !this.connected || this.state.busy) return;
    const request = context.view === "activity" ? "Explain the selected Activity interval in BigBoard using its supporting evidence." : "Explain the person selected in BigBoard using their supporting evidence.";
    await this.sendSelection(context, request);
  }

  async destroy(closeBridge = true): Promise<void> {
    this.destroyed = true;
    this.connected = false;
    this.viewReady = false;
    this.boardReadSequence += 1;
    this.evidenceSequence += 1;
    this.peopleSequence += 1;
    this.contextSequence += 1;
    if (this.poll) clearInterval(this.poll);
    this.listeners.clear();
    if (closeBridge) await this.bridge.close();
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "BigBoard could not complete that request. Try again.";
  }
}
