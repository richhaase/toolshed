# <img src="assets/icon.png" width="64" height="64" align="middle" alt=""> BigBoard plugin

Explore commit activity and contributors across your repositories. Select a
chart interval or a person to inspect the underlying records with your agent.

## Install or update

BigBoard v0.6.0 is distributed from toolshed. The original native macOS app is
[archived](https://github.com/richhaase/bigboard); future development lives here.

Requires Node.js 24 or later, Git, and existing local clones with a github.com remote.
Both dashboards use local Git history and work offline.
The visual board requires a host with MCP Apps support. Installation uses
committed bundles and needs no compiler, `npm install`, or install script.

```sh
codex plugin marketplace add richhaase/toolshed
codex plugin add bigboard@toolshed
```

For published updates:

```sh
codex plugin marketplace upgrade toolshed
codex plugin add bigboard@toolshed
```

Start a fresh local chat after updating and select **BigBoard**. Skill IDs remain
`bigboard:explore` and `bigboard:configure`, with generated namespace labels.

### Move from the earlier BigBoard marketplace

Install `bigboard@toolshed` first. Verify it is installed and enabled with
`codex plugin list --marketplace toolshed`, then remove whichever older entries
are installed:

```sh
codex plugin remove bigboard@bigboard-mcp
codex plugin remove bigboard-mcp-app@bigboard-mcp
```

Saved sources, evidence, and boards remain outside the plugin cache in the
existing state directory.

## Activity and People

Configure existing clones through `bigboard:configure`. For example, ask the
agent to import your native BigBoard selection, refresh sources, and open
Activity. `configure_sources` with `import_native:true` copies selected
repositories from native settings read-only, honors exclusions, and reports
missing selected clones instead of silently shrinking the selection.
Alternatively, pass absolute existing clone `paths`. Source settings are shared
by history boards and require the revision returned by `list_sources` when
updated. An add/remove save includes all retained paths.

**Activity** opens with a commit chart and compact summary. Selecting an interval
reveals its supporting commits; closing details returns to the overview.
Highlights point to the busiest interval and, with comparison on, the largest
changes. Repository totals filter the board.
**People** ranks contributors by commit count for the selected period and
repositories, with each person's share of commits and, with comparison on, the
change from the previous period. Select a contributor to see their commits.

### Hosts that do not run panel tool calls

Some MCP Apps hosts display the panel without letting it call the server. The
server therefore embeds the collected Git history in the panel page. The panel
always tries the host first. If the host has never run a panel call, the panel
uses the embedded history for date, repository, comparison, interval, and
contributor views. It says so, and filter changes stay in that panel. **Ask to
refresh** sends a chat message because collection needs the server.

Each panel checks its history against the board that opened it. If the host
served an older page, the panel rereads it once, then asks the user to reopen
the board. Embedded history includes commit subjects, authors, emails, and line
counts. It omits local clone paths and file lists. Above 4 MiB it keeps the most
recent 90, 60, 28, or 14 days that fit. The panel still makes no network requests.

Use **Refresh sources** or `refresh_sources` to collect up to 180 days of Git
history. The status panel shows progress and coverage for the configured
repositories. Upgrading from 0.3 preserves saved boards, filters, sources,
and Git history. The next source refresh replaces the old collection with
Git-only data.

Git activity counts non-merge commits reachable from each clone's remote-tracking
default branch, using author dates in half-open intervals. Collection never
fetches or modifies clones, branches, the index, Git config, or maintenance
state. Update your tracking refs through your normal Git workflow. Scanned
revisions and shallow/partial coverage remain visible. A commit found in two
selected repositories counts once per repository.

Periods are rolling 24 hours, 7, 14, 30, or 90 days. Charts use hourly intervals
for 24 hours, daily intervals through 30 days, and weekly intervals for 90 days,
counted back in UTC from the collection time. The first weekly interval is
partial. Comparison uses the preceding equal window, so 180 days of history
covers every period. When collected history starts inside the selected period,
the board says when it starts and reports counts as lower bounds. Git authors use the
scanned revision's mailmap; names do not merge distinct email identities.
Line totals use all changed files. Evidence includes the first 25 paths per
commit and indicates when the list is truncated or line counts are unknown.

## Agent interaction and configuration

Use [`bigboard:configure`](skills/configure/SKILL.md) to choose shared
repository sources or change a board's date range, repository filter, and
comparison. Activity and People share the board's repository and date filters.

Use [`bigboard:explore`](skills/explore/SKILL.md) to open a board or discuss
a selection. `open_board` accepts `view:activity` or `view:people` and an
optional existing `board_id`. Navigation updates the agent's background
context with the board, snapshot, and selected interval or person.
**Explain selection** sends a short message asking the agent to inspect the
supporting evidence.

## Icons and desktop verification

The selected activity-easel PNG is packaged as the Codex plugin logo/composer
icon and as both skills' small/large icon. It is also embedded as a data URI
inside the app HTML and MCP server bundle. The app renders it without fetching
an external image; server and UI-resource metadata advertise the same icon.
The pinned SDK's high-level tool registration does not forward tool icons, so
no unsupported tool-icon field is added. Host-controlled card headers may
still show a generic icon. See the [shared icon guide](../../docs/icon-prompts.md)
for supported Codex/Claude surfaces and generation prompts.

Actual desktop acceptance should check both an updated installed plugin and a
fresh chat. Open Activity and People, verify the easel in the app header, and
check that repository and date filters apply to both views. Select a chart
interval and a person, then use **Explain selection** to check their supporting
records. Verify that source refresh reports partial coverage when applicable.
In a host that refuses panel calls, check that filters, People, and commit
details work from embedded history and that reopening shows newly collected data.
Record the desktop host and outcome separately from automated protocol and
rendered-bridge checks.

## Build and state

```sh
cd plugins/bigboard
fnm install
fnm exec npm ci
fnm exec npm run check
```

`bundle/server.cjs`, `bundle/board.html`, and bundled third-party licenses are
committed. CI rebuilds and rejects drift. MCP SDK 1.32.2 and MCP Apps 1.7.5 remain
pinned. Tests cover temporary Git repositories, the packaged stdio server,
durable state, and the app through the official MCP Apps bridge. Desktop-host
verification is recorded separately.

The server starts with `node bundle/server.cjs`. SQLite state stays under
`$XDG_STATE_HOME/bigboard-mcp-app`, or `~/.local/state/bigboard-mcp-app` when
unset. The legacy name preserves saved sources and boards. `BIGBOARD_STATE_DIR`
provides isolated state for tests. Native import honors `BIGBOARD_CONFIG_ROOT`
or `$XDG_CONFIG_HOME/bigboard/config.json`. Native data remains separate.
Early fixture boards keep their IDs and date controls while synthetic scope
is cleared.
