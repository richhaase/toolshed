---
name: configure
description: Inspect and update BigBoard settings, including shared repository sources, importing native selections, and per-board date, repository, and comparison controls.
---

# BigBoard configuration

Invoke `bigboard:configure`, or ask naturally to change BigBoard settings.
Inspect current state, apply the requested change when its choices are clear,
and keep unrelated settings intact. For a general request, explain the current
settings and clarify the desired change. Skip saves that would change nothing.
Every tool named below belongs to the `bigboard` MCP server.

## Shared history sources

`list_sources` returns local clone selection and its separate configuration
revision. `configure_sources` changes sources shared by Activity/People boards:

- For explicit existing clones, pass absolute `paths` and the current
  `expected_revision`. This replaces the whole saved selection. Add/remove
  requests must retain every other selected path. A repository URL is not a
  clone path; ask for the existing local path rather than cloning it.
- For the user's native BigBoard selection, pass `import_native:true` and
  `expected_revision`, omitting `paths`. Import reads native settings without
  modifying them or the clones.

Saving sources clears previously collected evidence. Verify the selection with
`list_sources`. On conflict, reread and reconcile.
For fresh history, call `refresh_sources` once unless `read_board` shows an
in-flight history refresh; allow up to 150 seconds and report coverage gaps.
Honor an explicit request to save without collecting.

## Activity/People viewing settings

Resolve `boardId` from current app context or the user's supplied ID. If the
intended board is unclear, ask them to select it. Create a new board only when
requested. Call `read_board`, then `update_board` with that board's current
`expected_revision` and only requested fields: `days` (1, 7, 14, 30 or 90), `repository`
(`all` or an ID from `list_sources`), and `compare` (boolean). Verify the
resulting query and revision; reconcile conflicts against current state.
These settings apply to the saved board and use the existing collection.

## Limits

Read/update tools do not switch the active tab. They do not configure global
viewing defaults, refresh cadence, authentication, credentials, or
contributor identity mappings. Explain unsupported requests rather than editing
code, host configuration, credentials, or clones as a workaround. Configuration help authorizes only the requested settings.
