# <img src="assets/icon.png" width="64" height="64" align="middle" alt=""> BigBoard plugin

Explore Git activity, people, and organization-wide pull requests with an agent.
Activity and People use your existing clones. Pull requests is a separate GitHub
review queue: the whole organization stays visible, with your action groups
first. Inspect evidence, select exact PRs, and share or request reviews in chat.

## Install or update

BigBoard v0.2.0 is distributed from toolshed. The original native macOS app is
[archived](https://github.com/richhaase/bigboard); future development lives here.

Requires Node.js 24 or later and an authenticated GitHub CLI on the desktop
host's PATH. Activity and People additionally need Git and existing local
clones. Organization PRs need no clones. The visual board requires a host with
MCP Apps support. Installation uses committed bundles and needs no compiler,
`npm install`, or install script.

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
existing state directory. The move to toolshed and its v0.1.0 version sequence
preserved that data; this update adds independent PR queries and collections.

## Organization pull requests

Ask the agent to open Pull requests for a GitHub organization, or set the
organization in the PR view. `open_board` accepts `view:pull_requests` and
`organization`. A board's organization, PR repository, attention filter, and
merged-history window are saved independently of its Activity/People settings.

The default is **the whole organization, your actions first**. The verified
GitHub CLI account determines who “you” means. Organization searches include
accessible repositories beyond your selected clones. Open PRs have no age
cutoff; authored discovery also runs separately to preserve the user's work
when the general search is bounded. Drafts and incomplete review states remain
visible. Merged history uses its own 7, 14, or 30-day window and includes target
branches across the organization, rather than only clone default branches.

### Attention groups

Open PRs default to **Attention first**. Classification and sorting happen over
the complete collected inventory before pagination; only grouping the loaded
page would hide higher-priority PRs on later pages. Group order is:

1. Awaiting your review.
2. Awaiting your re-review.
3. Respond to feedback on your PRs.
4. Assigned to you.
5. Awaiting reviewer on your PRs.
6. Ready to merge.
7. Other open PRs of yours, including drafts and unknown states.
8. Needs review across the organization.
9. Other organization PRs.

Oldest activity leads within each group by default. Every row explains why it
is there. Current-head reviews, explicit re-requests, dismissal history, author
responses, and reported checks inform these groups. Aggregate approval outranks
a later non-blocking comment; summary-only bot comments do not create author
action. Assignment is shown as assignment, not an inferred review request.

Unknown or truncated metadata remains marked incomplete. Team requests do not
establish team membership. Ready to merge describes the approvals and checks
seen at collection time; repository gates still apply. BigBoard never performs
reviews or merges merely because a row is grouped or selected.

### Controls, refresh, and selection

PR controls are organization, repository within that organization, attention
(**All**, **My work**, or **Needs my review**), Open/Merged, and sorting. Merged
also has its own history window. Activity's date range and comparison do not
filter the PR queue. Column sorts and attention ordering cover the full
collected list. Repository/attention filters, sorting, paging, and checkbox
selection do not recollect GitHub data.

Activating Pull requests, including direct opening, starts a **GitHub-only**
refresh and reuses an existing refresh. Changing organization while PRs is
active starts collection for that organization. Returning to the view refreshes
it again. Progress distinguishes discovery from review-detail enrichment.
The queue has its own saved revision, evidence snapshot, progress, and account
verification; a PR refresh does not replace Activity's snapshot or selection.

Select a row to inspect its exact PR. Checkboxes maintain a separate batch of
up to 100 PRs. **Select loaded** adds only loaded rows; it does not include
unseen pages. Sorting and paging preserve the checked set. Scope, state, account,
or snapshot changes clear it. **Share selection** discusses that batch;
**Request code reviews** sends a review request for the same set. Checkbox
changes alone do not launch reviews. Background context carries exact PR URLs,
head SHAs, organization, verified reviewer, and PR query/snapshot, so “review
these” refers to the checked batch.

### Coverage and limits

Organization collection uses GitHub CLI authentication in memory, up to three
concurrent requests, a 128-request budget, bounded search pages, 2 MiB response
bodies, and a 120-second collector deadline inside a 150-second refresh window.
Oversized review-detail batches split into smaller requests within those same
limits. Merged-only batches omit the history needed for open-PR attention groups.
Each open search is capped at 1,000 results; merged discovery covers the last
30 days with a 400-result cap. Authored open discovery is separate and also
bounded. Search truncation, changing pages, denied repositories, unavailable
fields, and bounded review/comment connections produce honest partial
coverage. Counts are lower bounds when incomplete; zero does not prove absence.

After a server restart, cached PR evidence is hidden until a refresh verifies
GitHub access for that session. Access denial, an account change, or cancellation
must not expose another account's cached PRs. Refresh progress is separate from
the completed snapshot; stale running progress expires after three minutes.

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
for supporting evidence. These views use the configured-source collection,
not the organization PR queue, and retain independent repository/date controls.
Use **Refresh sources** or `refresh_sources` for fresh history; it collects up
to 28 days of local Git and configured repositories' GitHub evidence, with
separate Git/GitHub repository progress. PR activation does not run this refresh.

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

`bigboard:configure`, or a natural request to change BigBoard settings, handles
both kinds of scope. It inspects current state, clarifies unspecified choices,
and applies explicit choices directly. Configuration guidance stays in the
agent; there is no configure-sources action added to the app.

For organization PRs, use `read_pull_request_queue`, then
`update_pull_request_queue` with that queue's `revision` as `expected_revision`.
Fields are `organization`, `repository`, `attention:all|mine|review`, and
`days:7|14|30`. Verify with a fresh queue read. `refresh_pull_requests` refreshes
GitHub only. `query_pull_requests` accepts its exact `snapshot_id`,
`pull_request_state`, `pull_request_sort` (including `attention`),
`sort_direction`, optional exact `pull_request_id`, and a snapshot-bound cursor.

For history, use `read_board`, `update_board`, `query_people`, and
`query_evidence` with the history revision/snapshot. `update_board` controls
`days:7|14`, configured `repository`, and `compare`; it does not change PR scope.
`query_evidence` retains its legacy configured-source PR route for historical
and People evidence. Never interchange history and organization PR snapshots.
`read_board` includes the independent `pullRequestQueue` for capable app clients;
older board snapshots remain supported by the UI.

Navigation and selection use background model context rather than posting a
chat turn or inserting JSON into the composer. Structured context is used when
the host supports it; text-only fallback is marked for the assistant audience.
Explicit Explain, Share, and Review actions send brief human-readable messages.
The agent follows its host's normal review workflow and verifies current PR
state/head before reviewing an older selection. Reads and updates do not switch
the app's active tab; `open_board` chooses a tab when opening.

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
fresh chat. Open Activity, People, and organization PRs; verify the easel in the
app header, organization controls without clones, attention ordering across
pages, independent refreshes and history filters, exact multi-selection after
sorting, and truthful partial coverage. Test ordinary selection and explicit
Share/Review separately. Record the desktop host and outcome; automated
protocol and rendered-bridge checks do not establish desktop-host rendering.

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
