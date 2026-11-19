---
name: explore
description: Open BigBoard Activity and People, compare repository activity, and inspect the commits or pull requests behind a selected interval or contributor.
---

# BigBoard exploration

Invoke `bigboard:explore`, or ask naturally to open or discuss BigBoard.
Use the bundled tools to inspect activity in the configured repositories.
For settings changes, use [`bigboard:configure`](../configure/SKILL.md).

## Open a board

Call `open_board` without `board_id` for a new independent board, or with the
exact existing ID to reopen it. Set `view` to `activity` or `people`.
Resolve an ambiguous board from the user's selection or ask for its ID.
Create another board only when requested.

The view argument chooses the opening tab. Reading or updating saved scope
does not switch tabs. Keep the existing panel for follow-up questions.

## Activity and People

Use `list_sources` for shared clone selection. Call `refresh_sources` when
fresh history is requested or no collection exists, allowing up to 150
seconds. It reads existing remote-tracking default branches without fetching
or modifying clones and collects the configured repositories' GitHub evidence.
Check `read_board` for an in-flight refresh before starting another. Report
coverage and collection time. Refresh after a server restart to verify GitHub
access before using cached GitHub evidence.

Use `read_board`, then `query_evidence` with the history board's `snapshotId`.
Activity uses `kind:activity` and the selected `bucket_start` when present.
People uses `query_people` with `source:git` or `github`; a selected person's
supporting evidence uses `query_evidence` and exact `person_id`. Git identities
are mailmapped emails; GitHub authors are logins. Do not link identities by
similar display names. Commit and merged PR counts use the board's repository
and date filters. Open PR counts are current as of collection time.

Report scanned revisions and unknown line counts where relevant. Treat counts
with incomplete coverage as lower bounds. If the selection's snapshot has
changed, refresh the selection before attributing records. Follow `nextCursor`
with the same snapshot and filters to inspect more evidence.

Ordinary navigation updates background app context. When the user chooses
**Explain selection**, use the interval or person identified in that context
to retrieve the supporting records.
