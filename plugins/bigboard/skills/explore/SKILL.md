---
name: explore
description: Open BigBoard Activity and People, compare repository activity, and inspect the commits behind a selected interval or contributor.
---

# BigBoard exploration

Invoke `bigboard:explore`, or ask naturally to open or discuss BigBoard.
Use the `bigboard` MCP server's tools, named below, to inspect activity in the
configured repositories.
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
or modifying clones. Check `read_board` for an in-flight refresh before
starting another. Report coverage and collection time.

Use `read_board`, then `query_evidence` with the history board's `snapshotId`.
For Activity, pass the selected `bucket_start` when present. For People, use
`query_people` to list contributors and pass the selected `person_id` to
`query_evidence` to inspect their commits. Contributors are grouped by
mailmapped Git email within the board's repository and date filters.

Report scanned revisions and unknown line counts where relevant. Treat counts
with incomplete coverage as lower bounds. If the selection's snapshot has
changed, refresh the selection before attributing records. Follow `nextCursor`
with the same snapshot and filters to inspect more evidence.

Panel context can include `summary` with totals, leading repositories, people,
and highlights. Use it to describe the current view, and retrieve evidence before
explaining causes.

When context has `unsaved: true`, the panel is using embedded history and its
filters are not saved. To retrieve its evidence, call `read_board`, then
`update_board` with the context's query and the current revision, and use the
returned `snapshotId`. This saves those filters to the board. If the user asks to
refresh such a panel, refresh sources and reopen the same board.

Ordinary navigation updates background app context. When the user chooses
**Explain selection**, use the interval or person identified in that context
to retrieve the supporting records.
