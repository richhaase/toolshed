import { useSyncExternalStore } from "react";
import { BIGBOARD_ICON_DATA_URL } from "../branding";
import { PERIOD_DAYS, type ActivityRecord, type BoardHighlight, type BoardSnapshot, type BucketInterval, type RefreshProgress } from "../shared";
import type { BoardController } from "./controller";

const count = new Intl.NumberFormat("en-US");

export function dateLabel(value: string, timezone = "UTC"): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: timezone }).format(new Date(value));
}

function moment(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: timezone, timeZoneName: "short" }).format(new Date(value));
}

function intervalLabel(value: string, interval: BucketInterval, timezone: string): string {
  return interval === "hour" ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(value)) : dateLabel(value, timezone);
}

function axisLabel(value: string, interval: BucketInterval, timezone: string): string {
  return interval === "hour" ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(value)) : dateLabel(value, timezone);
}

const INTERVAL_TEXT: Record<BucketInterval, { chart: string; instruction: string }> = {
  hour: { chart: "Hourly commits", instruction: "Select a one-hour interval to inspect its commits." },
  day: { chart: "Daily commits", instruction: "Select a 24-hour interval to inspect its commits." },
  week: { chart: "Weekly commits", instruction: "Select a seven-day interval to inspect its commits. The first interval may be shorter." },
};

function periodLabel(days: number): string {
  return days === 1 ? "24 hours" : `${days} days`;
}

function githubLink(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" ? url.href : undefined;
  } catch { return undefined; }
}

function CommitRow({ record, timezone }: { record: ActivityRecord; timezone: string }) {
  return <article className="evidence-row">
    <div className="record-main"><strong><a href={githubLink(record.url)} target="_blank" rel="noopener noreferrer">{record.subject}</a></strong><div><span className="repository-name">{record.repository}</span><span>{record.contributor}</span><time dateTime={record.timestamp}>{moment(record.timestamp, timezone)}</time></div></div>
    <div className="record-numbers"><span className="additions">{record.additions === null ? "unknown" : `+${record.additions}`}</span><span className="deletions">{record.deletions === null ? "unknown" : `−${record.deletions}`}</span><span className="record-id">{record.sha.slice(0, 10)}</span></div>
  </article>;
}

function change(commits: number, previous: number | null | undefined): string {
  if (previous === null || previous === undefined) return "";
  const difference = commits - previous;
  return `${difference > 0 ? "+" : difference < 0 ? "−" : ""}${count.format(Math.abs(difference))} vs previous`;
}

type Trend = "up" | "down" | "flat";

function trend(difference: number): Trend {
  return difference > 0 ? "up" : difference < 0 ? "down" : "flat";
}

function signed(difference: number): string {
  return `${difference > 0 ? "+" : difference < 0 ? "−" : "±"}${count.format(Math.abs(difference))}`;
}

function percentChange(commits: number, previous: number): string {
  if (previous === 0) return commits === 0 ? "0%" : "new";
  const value = Math.round(Math.abs(commits - previous) / previous * 100);
  return `${commits > previous ? "+" : commits < previous ? "−" : ""}${value}%`;
}

function Delta({ commits, previous }: { commits: number; previous: number }) {
  const difference = commits - previous;
  return <em className={`delta ${trend(difference)}`} title={`${count.format(previous)} in previous period`}>{signed(difference)} <span>{percentChange(commits, previous)}</span></em>;
}

function highlightText(highlight: BoardHighlight, label: (value: string) => string): string {
  const total = highlight.previousCommits === null ? `${count.format(highlight.commits)} commits` : `${count.format(highlight.previousCommits)} → ${count.format(highlight.commits)} commits (${signed(highlight.commits - highlight.previousCommits)} vs previous period)`;
  if (highlight.kind === "repository-change") return `${highlight.repository}: ${total}`;
  return `${highlight.kind === "peak" ? "Busiest interval" : "Largest change"}, ${label(highlight.bucketStart!)}: ${total}`;
}

function RefreshStatus({ progress, starting }: { progress: RefreshProgress | null | undefined; starting: boolean }) {
  if (!progress && !starting) return null;
  const running = starting || progress?.status === "running";
  const status = running ? "running" : progress!.status;
  return <section className={`refresh-progress ${status}`} aria-label="Source refresh progress" role="status" aria-atomic="true">
    <div className="refresh-progress-heading"><strong>{starting ? "Starting source refresh…" : running ? "Refreshing sources" : status === "complete" ? "Refresh finished" : status === "cancelled" ? "Refresh cancelled" : "Refresh stopped"}</strong>{running && !starting && <span>Repositories processed</span>}</div>
    {starting ? <progress aria-label="Starting source refresh" /> : <>
      <p>{progress!.message}</p>
      {running && <div className="refresh-progress-sources">
        <label><span>Git history <span>{progress!.git.completedRepositories} / {progress!.git.totalRepositories}</span></span><progress aria-label="Git repositories processed" value={progress!.git.completedRepositories} max={Math.max(1, progress!.git.totalRepositories)} /></label>
      </div>}
    </>}
  </section>;
}

function SourceStatus({ board, timezone }: { board: BoardSnapshot; timezone: string }) {
  const label = !board.configuration.repositories.length ? "No sources" : board.refresh?.status === "running" ? "Refreshing" : !board.collectedAt ? "Not collected" : board.configuration.needsRefresh ? "Needs refresh" : board.coverage.complete ? "Collected" : "Partial coverage";
  return <details className="source-status">
    <summary aria-label={`Source status: ${label}`}><span className={board.coverage.complete && !board.configuration.needsRefresh ? "ready-dot" : "attention-dot"} />{label}</summary>
    <section className="status-panel" aria-label="Source coverage">
      <h2>Source coverage</h2><p>{board.coverage.note}</p>
      <p>{board.collectedAt ? `Collected ${moment(board.collectedAt, timezone)}` : "No evidence collected yet"}</p>
      <p>To change collected repositories, ask your agent to use bigboard:configure with local Git clone paths or your native BigBoard selection.</p>
      <div className="source-coverage">{board.coverage.repositories.map((source) => <article key={source.repository}>
        <strong>{source.repository}</strong><p>{source.historyComplete ? "Git history available" : "Git history incomplete"} · {source.linesComplete ? "Line counts available" : "Line counts incomplete"}</p>
        <p className="repository-name">{source.ref} · {source.revision?.slice(0, 12) ?? "revision unavailable"}{source.shallow ? " · shallow clone" : ""}{source.partial ? " · partial clone" : ""}</p>
        {source.errors.map((error) => <p className="source-error" key={error}>{error}</p>)}
      </article>)}</div>
      <details className="board-details"><summary>Board details</summary><dl><dt>Board</dt><dd>{board.boardId}</dd><dt>Revision</dt><dd>{board.revision}</dd><dt>Snapshot</dt><dd>{board.snapshotId}</dd></dl></details>
    </section>
  </details>;
}

export function BoardView({ controller }: { controller: BoardController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const board = state.snapshot;
  const activity = state.view === "activity";
  const peopleView = state.view === "people";
  const selected = activity ? board?.buckets.find((bucket) => bucket.start === state.selectedBucket) : undefined;
  const selectedPerson = peopleView ? state.people.find(person => person.id === state.selectedPersonId) : undefined;
  const peopleMax = Math.max(1, ...state.people.map(person => person.commits));
  const chartMax = Math.max(1, ...board?.buckets.flatMap((bucket) => [bucket.commits, bucket.previousCommits ?? 0]) ?? []);
  const comparing = Boolean(board?.query.compare && board.totals.previousCommits !== null);
  const deltaMax = Math.max(1, ...board?.buckets.map((bucket) => Math.abs(bucket.commits - (bucket.previousCommits ?? bucket.commits))) ?? []);
  const priorStart = (value: string) => new Date(Date.parse(value) - (board?.query.days ?? 0) * 86_400_000).toISOString();
  const timezone = board?.scope.timezone ?? "UTC";
  const hasSources = Boolean(board?.configuration.repositories.length);
  const hasCollection = hasSources && Boolean(board?.collectedAt);
  const refreshRunning = state.sourceRefreshing || board?.refresh?.status === "running";
  const historyComplete = Boolean(board?.coverage.repositories.every(source => source.historyComplete) && !board.historyStart);
  const interval = board?.interval ?? "day";
  const label = (value: string) => intervalLabel(value, interval, timezone);
  const columns = board?.buckets.length ?? 0;
  const labelStep = columns > 14 ? Math.ceil(columns / 8) : 1;
  const hasDetails = Boolean(selected || selectedPerson);
  const closeActivity = () => {
    const start = selected?.start;
    void controller.selectBucket(null).then(() => {
      if (start) document.querySelector<HTMLButtonElement>(`[data-bucket-start="${start}"]`)?.focus();
    });
  };

  const closePerson = () => {
    const id = selectedPerson?.id;
    void controller.selectPerson(null).then(() => {
      if (id) [...document.querySelectorAll<HTMLButtonElement>("[data-person-id]")].find(button => button.dataset.personId === id)?.focus();
    });
  };

  return <main className="bigboard" aria-label="BigBoard">
    <header className="board-header">
      <div className="wordmark"><img src={BIGBOARD_ICON_DATA_URL} alt="" aria-hidden="true" width="34" height="34" /><span>BigBoard</span></div>
      <div className="source-controls">{board && <SourceStatus board={board} timezone={timezone} />}{state.local ? <button className="refresh-sources" disabled={state.busy} onClick={() => void controller.requestRefresh()}>Ask to refresh</button> : <button className="refresh-sources" disabled={state.busy || refreshRunning || !hasSources} onClick={() => void controller.refreshSources()}>{refreshRunning ? "Collecting…" : "Refresh sources"}</button>}</div>
    </header>
    <nav className="board-navigation" aria-label="Board views"><button aria-pressed={activity} onClick={() => void controller.setView("activity")}>Activity</button><button aria-pressed={peopleView} onClick={() => void controller.setView("people")}>People</button></nav>
    {state.error && <div className="message error" role="alert"><span>{state.error}</span><button onClick={() => void controller.retry()}>Try again</button></div>}
    {state.local && board?.collectedAt && <p className="local-mode" role="status">This app does not let the panel reach BigBoard's server. You are exploring data collected {moment(board.collectedAt, timezone)}. Filter changes apply to this panel only.</p>}
    {board?.historyStart && <p className="local-mode" role="status">{board.configuration.needsRefresh ? `Collected history starts ${moment(board.historyStart, timezone)}. Refresh sources to fill this period.` : `This panel holds history from ${moment(board.historyStart, timezone)}. Ask your agent for earlier commits.`}</p>}
    {state.notice && <div className="message success" role="status">{state.notice}</div>}
    <RefreshStatus progress={board?.refresh} starting={state.sourceRefreshing && (board?.refresh?.id ?? null) === state.sourceRefreshPreviousId} />
    {!board ? state.phase === "overdue" ? <div className="waiting" role="status"><h2>The board has not arrived</h2><p>This panel is connected but did not receive its board. Ask your agent to reopen it. A board that arrives late will still open here.</p><button disabled={state.busy} onClick={() => void controller.requestReopen()}>Ask to reopen</button></div> : <div className="waiting" role="status"><span className="loading-mark" /><h2>{state.phase === "connecting" ? "Connecting to your conversation" : "Waiting for the board"}</h2><p>{state.error ? "Reopen BigBoard from the conversation if the connection does not recover." : "Your board will appear here when BigBoard is ready."}</p></div> : <>
      <div className="view-heading"><h1>{activity ? "Activity" : "People"}</h1>{hasCollection && <p className="date-scope">{label(board.scope.since)} – {label(board.scope.until)}<span>{timezone}</span></p>}</div>
      <section className="toolbar" aria-label={activity ? "Activity controls" : "People controls"}>
        <label className="repository-filter">Repository<select value={board.query.repository} disabled={state.busy || !hasSources} onChange={(event) => void controller.changeQuery({ repository: event.target.value })}><option value="all">All repositories</option>{board.configuration.repositories.map(repository => <option key={repository} value={repository}>{repository}</option>)}</select></label>
        <div className="period-control" role="group" aria-label="Date range">{PERIOD_DAYS.map(days => <button key={days} aria-pressed={board.query.days === days} disabled={state.busy || !hasSources} onClick={() => void controller.changeQuery({ days })}>{periodLabel(days)}</button>)}</div>
        <label className="compare-control"><input type="checkbox" checked={board.query.compare} disabled={state.busy || !hasSources} onChange={(event) => void controller.changeQuery({ compare: event.target.checked })} />Compare previous period</label>
      </section>
      {!hasSources ? <section className="setup-state" aria-label="Configure repositories"><h2>Choose the repositories to collect</h2><p>Ask your agent to use bigboard:configure to reuse your native BigBoard selection or choose local Git clones.</p><p>Your saved collection selection is shared across boards.</p></section> : !hasCollection ? <section className="setup-state" aria-label="Collect repository evidence"><h2>Sources are ready</h2><p>Refresh sources to collect evidence for your {board.configuration.repositories.length} selected repositories.</p></section> : <div className={`workspace-layout${hasDetails ? " has-details" : ""}`}>
        <section className="view-content" aria-label={activity ? "Activity overview" : "People view"}>
          {activity ? <>
            <div className="activity-summary" aria-label="Activity totals"><p className="primary-total"><strong>{count.format(board.totals.commits)}{historyComplete ? "" : "+"}</strong><span>commits</span></p><p className="line-total"><span className="additions">+{count.format(board.totals.additions)}</span><span className="deletions">−{count.format(board.totals.deletions)}</span><span>{board.totals.unknownLineCommits ? "known lines · lower bound" : "lines changed"}</span></p>{board.query.compare && (board.totals.previousCommits === null ? <p className="comparison-total">Previous period unavailable</p> : <p className={`comparison-total ${trend(board.totals.commits - board.totals.previousCommits)}`}><strong><span aria-hidden="true">{board.totals.commits > board.totals.previousCommits ? "▲" : board.totals.commits < board.totals.previousCommits ? "▼" : "■"} </span>{signed(board.totals.commits - board.totals.previousCommits)} <span>{percentChange(board.totals.commits, board.totals.previousCommits)}</span></strong><span>vs {count.format(board.totals.previousCommits)} in the previous {periodLabel(board.query.days)}</span></p>)}</div>
            <section className="activity-chart" aria-label={INTERVAL_TEXT[interval].chart}><div className="chart-heading"><h2>Commits by author date</h2>{board.query.compare && <div className="legend"><span><i className="current-key" />This period</span><span><i className="previous-key" />Previous</span>{comparing && <span><i className="change-key" />Change</span>}</div>}</div><div className={`chart-frame${comparing ? " comparing" : ""}`}><div className="chart-scale" aria-hidden="true"><span>{chartMax}</span><span>0</span></div><div className={`chart-columns${columns > 14 ? " many" : columns > 7 ? " dense" : ""}`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{board.buckets.map((bucket, index) => <button className={`day-column${state.selectedBucket === bucket.start ? " selected" : ""}`} key={bucket.start} data-bucket-start={bucket.start} aria-label={`${label(bucket.start)}: ${bucket.commits} commits${bucket.previousCommits !== null ? `, ${bucket.previousCommits} in previous period (${label(priorStart(bucket.start))}), ${signed(bucket.commits - bucket.previousCommits)}` : ""}`} title={`${moment(bucket.start, timezone)} to ${moment(bucket.end, timezone)}${comparing && bucket.previousCommits !== null ? `\nPrevious: ${bucket.previousCommits} commits from ${moment(priorStart(bucket.start), timezone)}` : ""}`} aria-pressed={state.selectedBucket === bucket.start} onClick={() => void controller.selectBucket(state.selectedBucket === bucket.start ? null : bucket.start)}><span className="column-count">{columns <= 14 || bucket.commits === chartMax || state.selectedBucket === bucket.start ? bucket.commits : "\u00a0"}</span><span className="bar-track">{board.query.compare && bucket.previousCommits !== null && <span className="bar previous-bar" style={{ height: `${bucket.previousCommits / chartMax * 100}%` }} />}<span className={`bar current-bar${bucket.commits === 0 ? " empty-bar" : ""}`} style={{ height: `${bucket.commits / chartMax * 100}%` }} /></span>{comparing && <span className="delta-track" aria-hidden="true">{bucket.previousCommits !== null && bucket.commits !== bucket.previousCommits && <><span className={`delta-bar ${trend(bucket.commits - bucket.previousCommits)}`} style={{ height: `${Math.abs(bucket.commits - bucket.previousCommits) / deltaMax * 50}%` }} />{(columns <= 14 || state.selectedBucket === bucket.start) && <span className={`delta-label ${trend(bucket.commits - bucket.previousCommits)}`}>{signed(bucket.commits - bucket.previousCommits)}</span>}</>}</span>}<span className="day-label">{index % labelStep === 0 ? axisLabel(bucket.start, interval, timezone) : "\u00a0"}</span><span className="selection-tick" /></button>)}</div></div><p className="chart-instruction">{INTERVAL_TEXT[interval].instruction}</p></section>
            {Boolean(board.highlights?.length) && <section className="breakdown" aria-label="Highlights"><h2>Highlights</h2>{board.highlights!.map(highlight => <button key={highlight.kind} className="breakdown-row" disabled={state.busy} onClick={() => void controller.showHighlight(highlight)}><span>{highlightText(highlight, label)}</span></button>)}</section>}
            {Boolean(board.repositories?.length) && <section className="breakdown" aria-label="Repository totals"><h2>Repositories</h2>{board.repositories!.slice(0, 8).map(total => <button key={total.repository} className="breakdown-row" aria-pressed={board.query.repository === total.repository} disabled={state.busy} onClick={() => void controller.changeQuery({ repository: board.query.repository === total.repository ? "all" : total.repository })}><span className="repository-name">{total.repository}</span><span>{count.format(total.commits)}{total.previousCommits !== null && <Delta commits={total.commits} previous={total.previousCommits} />}</span></button>)}{board.repositories!.length > 8 && <p className="breakdown-more">and {board.repositories!.length - 8} more</p>}</section>}
          </> : <>
            <p className="inventory-count">{state.totalPeople}{historyComplete ? "" : "+"} {state.totalPeople === 1 ? "contributor" : "contributors"}</p>
            <p className="view-instruction">Contributors are ranked by commits in this period. Git email identities use each repository’s mailmap.</p>
            {state.people.length === 0 ? <p className="empty-view" role="status">{state.peopleLoading ? "Loading people…" : historyComplete ? "No people in this scope." : "No people are available. Check source coverage before treating this as zero."}</p> : <div className="people-inventory" aria-label="People records">
              {state.people.map((person, index) => <button key={person.id} data-person-id={person.id} className={selectedPerson?.id === person.id ? "person-row selected" : "person-row"} aria-label={`Select person ${person.name}: ${person.identity}`} aria-pressed={selectedPerson?.id === person.id} onClick={() => void controller.selectPerson(selectedPerson?.id === person.id ? null : person.id)}>
                <span className="person-rank" aria-hidden="true">{index + 1}</span>
                <span className="person-main"><strong>{person.name}</strong><span className="person-identity">{person.identity}</span><span className="person-bar" aria-hidden="true"><span style={{ width: `${person.commits / peopleMax * 100}%` }} /></span></span>
                <span className="person-numbers">
                  <strong>{count.format(person.commits)}{historyComplete ? "" : "+"} commits</strong>
                  <span>{board.totals.commits > 0 && `${Math.round(person.commits / board.totals.commits * 100)}% of commits`}{board.query.compare && person.previousCommits !== null && person.previousCommits !== undefined && ` · ${change(person.commits, person.previousCommits)}`}</span>
                  <span><span className="additions">+{count.format(person.additions)}</span> <span className="deletions">−{count.format(person.deletions)}</span>{person.unknownLineCommits > 0 ? " known lines" : " lines"}</span>
                  <span>{person.repositories.length} {person.repositories.length === 1 ? "repository" : "repositories"}</span>
                </span>
              </button>)}
            </div>}
            {state.peopleNextCursor && <div className="load-more"><span>{state.people.length} of {state.totalPeople}</span><button disabled={state.peopleLoading} onClick={() => void controller.loadMorePeople()}>{state.peopleLoading ? "Loading…" : "Load more people"}</button></div>}
          </>}
        </section>
        {hasDetails && <aside className="detail-pane" aria-label={selected ? "Activity evidence" : "People evidence"}>
          {selected ? <>
            <div className="detail-heading"><div><p className="eyebrow">Selected interval</p><h2>{label(selected.start)}</h2></div><button className="close-detail" aria-label="Close activity evidence" onClick={closeActivity}>×</button></div>
            <p className="selection-interval">{moment(selected.start, timezone)} – {moment(selected.end, timezone)}</p>
            <p className="detail-count">{selected.commits}{historyComplete ? "" : "+"} supporting commits</p>
          </> : selectedPerson && <>
            <div className="detail-heading"><div><p className="eyebrow">Git contributor</p><h2>{selectedPerson.name}</h2></div><button className="close-detail" aria-label="Close people evidence" onClick={closePerson}>×</button></div>
            <p className="repository-name person-detail-identity">{selectedPerson.identity}</p>
            <p className="detail-count">{selectedPerson.repositories.join(" · ")}</p>
          </>}
          {state.records.length === 0
            ? <p className="evidence-empty">{state.evidenceLoading ? "Loading supporting commits…" : historyComplete ? "No commits in this scope." : "No commits are available. Source coverage is incomplete."}</p>
            : <div className="evidence-list" tabIndex={0} aria-label="Commit records">{state.records.map(record => <CommitRow key={record.id} record={record} timezone={timezone} />)}</div>}
          {state.nextCursor && <div className="load-more"><span>{state.records.length} of {state.totalRecords}</span><button disabled={state.evidenceLoading} onClick={() => void controller.loadMore()}>{state.evidenceLoading ? "Loading…" : "Load more evidence"}</button></div>}
          <SelectionAction controller={controller} busy={state.busy} ready={state.contextReady} failed={state.contextFailed} />
        </aside>}
      </div>}
    </>}
  </main>;
}

function SelectionAction({ controller, busy, ready, failed }: { controller: BoardController; busy: boolean; ready: boolean; failed: boolean }) {
  return <div className="selection-action"><button className="explain-button" disabled={busy || !ready} onClick={() => void controller.explainSelection()}>Explain selection</button><p className="context-status" role="status"><span className={ready ? "ready-dot" : "pending-dot"} />{ready ? "Ready for your next question" : failed ? "Selection could not be shared. Try again above." : "Sharing selected scope…"}</p></div>;
}
