# <img src="assets/icon.png" width="64" height="64" align="middle" alt=""> BigBoard plugin

Explore commit activity and contributors across your repositories. Select a
chart interval or a person to inspect the underlying records with your agent.

## Install or update

BigBoard v0.3.0 is distributed from toolshed. The original native macOS app is
[archived](https://github.com/richhaase/bigboard); future development lives here.

Requires Node.js 24 or later, Git, and existing local clones. GitHub author
data also requires an authenticated GitHub CLI on the desktop host's PATH.
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
**People** has separate Git contributors and GitHub authors. Select a person
for supporting commits or pull requests from the selected repositories. Open
PRs reflect collection time. Merged PRs follow the selected date range.

Use **Refresh sources** or `refresh_sources` to collect up to 28 days of Git
history and the configured repositories' GitHub evidence. The status panel
shows Git and GitHub progress and coverage separately. After a server restart,
refresh to verify GitHub access before reading cached GitHub evidence.

Git activity counts non-merge commits reachable from each clone's remote-tracking
default branch, using author dates in half-open intervals. Collection never
fetches or modifies clones, branches, the index, Git config, or maintenance
state. Update your tracking refs through your normal Git workflow. Scanned
revisions and shallow/partial coverage remain visible. A commit found in two
selected repositories counts once per repository.

History windows are rolling 7 or 14 days; chart bars are consecutive 24-hour UTC
intervals. Comparison uses the preceding equal window. Git authors use the
scanned revision's mailmap; names do not merge distinct email identities.
GitHub authors remain distinct logins. Unknown line counts and truncated file
lists are explicit. Configured-source merged evidence targets default branches
and follows the history window; merged does not establish deployed.

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
pinned. Tests cover temporary Git repositories, mocked GitHub requests, the
packaged stdio server, durable state, and the app through the official MCP Apps
bridge; desktop-host verification is recorded separately.

The server starts with `node bundle/server.cjs`. SQLite state stays under
`$XDG_STATE_HOME/bigboard-mcp-app`, or `~/.local/state/bigboard-mcp-app` when
unset. The legacy name preserves saved sources and boards. `BIGBOARD_STATE_DIR`
provides isolated state for tests. Native import honors `BIGBOARD_CONFIG_ROOT`
or `$XDG_CONFIG_HOME/bigboard/config.json`; native data remains separate and
tokens are never persisted. Early fixture boards keep their IDs/date controls
while synthetic scope is cleared; production collection returns no demo data.
