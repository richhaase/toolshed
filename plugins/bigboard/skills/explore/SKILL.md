---
name: explore
description: Open and discuss BigBoard Activity, People, and organization-wide Pull requests, inspect evidence, find PRs needing attention, and discuss or review an exact selected PR batch.
---

# BigBoard exploration

Invoke `bigboard:explore`, or ask naturally to open or discuss BigBoard.
Use the bundled tools. Activity and People use configured local clones;
Pull requests has an independent organization scope and needs no clones.
For settings changes, use [`bigboard:configure`](../configure/SKILL.md).

## Open a board

Call `open_board` without `board_id` for a new independent board, or with the
exact existing ID to reopen it. `view` is `activity`, `people`, or
`pull_requests`. For an organization PR queue, pass the requested GitHub
`organization`. Resolve an ambiguous board from the user's selection or ask
for its ID; create another board only when requested.

The view argument chooses the opening tab. Reading or updating saved scope
does not switch tabs. Keep the existing panel for follow-up questions.

## Organization PR queue

Read `read_pull_request_queue` with `board_id`. Its PR `revision`, `snapshotId`,
query, verified account, coverage, and refresh status are independent of
Activity/People. App context includes `pullRequestQuery` and `reviewer` when
this queue is active; use that scope and the PR snapshot for follow-ups.

Call `query_pull_requests` with `board_id` and that exact `snapshot_id`.
Choose `pull_request_state:open` or `merged`; pass `pull_request_id` for an
inspected row. Open PRs have no age cutoff. Merged uses the queue's own 7, 14,
or 30-day window, not Activity's interval or comparison. Merged does not
establish deployed.

Default Open ordering is `pull_request_sort:attention`, `sort_direction:asc`:
personal review requests, re-reviews, feedback and assignments lead, followed
by waiting/ready/other authored PRs, organization review work, and other PRs.
Within a group, oldest activity leads. Other sorts are `updated`, `created`,
`number`, `title`, `author`, and `repository`. Sorting covers the complete
collected inventory before pagination; group counts are not just loaded rows.
Follow `nextCursor` with the same query, snapshot, state, and sorting.

Use each PR's `attention.label`, `attention.reason`, and `incomplete` flag to
explain its position. Unknown or truncated review history cannot establish
that nobody needs to act. Team requests do not establish the user's team
membership. A ready-to-merge group describes observed approvals and checks;
normal repository gates and authorization still apply.

The rendered PR view calls `refresh_pull_requests` on activation, including
direct opening, and reuses an in-flight refresh. Do not start a second refresh
just to open it. For a headless request needing fresh evidence, call that tool
once, allowing up to 150 seconds. It collects GitHub data only. Read queue
progress instead of refreshing while one is running; progress does not replace
the completed evidence snapshot. A server restart needs a refresh to verify
GitHub access before cached PRs become visible. Report coverage limits and
collection time; do not repair authentication as a recovery step.

## Activity and People

Use `list_sources` for shared clone selection. Call `refresh_sources` when
fresh history is requested or no collection exists, allowing up to 150
seconds. It reads existing remote-tracking default branches without fetching
or modifying clones and collects the configured repositories' GitHub evidence.
Read `read_board` for progress and coverage; do not duplicate a running refresh.

Use `read_board`, then `query_evidence` with the history board's `snapshotId`.
Activity uses `kind:activity` and the selected `bucket_start` when present.
People uses `query_people` with `source:git` or `github`; a selected person's
supporting evidence uses `query_evidence` and exact `person_id`. Git identities
are mailmapped emails; GitHub authors are logins. Do not link identities by
similar display names. These views retain their configured repository/date
scope and do not inherit the organization queue's controls.

The legacy `query_evidence` PR route remains for configured-source historical
context. Use it only with the history snapshot; never pass an organization
queue snapshot to that tool. Keep author dates, merge dates, scanned revisions,
unknown line counts, and incomplete coverage explicit. Zero under partial
coverage is not absence. On any snapshot mismatch, refresh the selection before
attributing records; cursors belong to their exact snapshot and filters.

## Selected PRs and reviews

Checkbox selections are `selectedPullRequests` in background app context.
Each record identifies repository, number, URL, and collected head SHA.
`pullRequestId` is the separately inspected row, not the checked batch. Use the
explicit checked set when the user says “these PRs”; do not expand it to every
loaded PR or the organization. Sorting preserves the set; scope or snapshot
changes clear it. If context is missing or stale, obtain a fresh selection.

Ordinary navigation updates background context without posting a chat turn.
Explicit Explain, Share selection, and Request code reviews actions send brief
human requests. Resolve exact records from the latest context and tools; do
not ask the user to paste a context blob. Checkboxes alone do not request work.

When reviews are requested, follow the host agent's applicable review workflow
and repository instructions. Verify current PR state and head before reviewing
because the collected snapshot may be older. BigBoard provides evidence and
selection context; it does not execute reviews or authorize merges.
