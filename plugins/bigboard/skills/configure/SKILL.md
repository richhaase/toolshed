---
name: configure
description: Inspect and update BigBoard settings, including organization PR scope and attention filters, shared local clone selection or native import, and Activity/People date, repository, and comparison controls.
---

# BigBoard configuration

Invoke `bigboard:configure`, or ask naturally to change BigBoard settings.
Inspect current state, apply the requested change when its choices are clear,
and keep unrelated settings intact. For a general request, explain the current
settings and clarify the desired change. Skip saves that would change nothing.

Resolve `boardId` from current app context or the user's supplied ID. If the
intended board is unclear, ask them to select it. Create a new board only when
requested. PR viewing scope and history settings are independent.

## Organization PR scope

Call `read_pull_request_queue` with `board_id`. Use its PR `revision` as
`expected_revision` for `update_pull_request_queue`; the history board's
revision is not interchangeable. Supported fields are:

- `organization`: the requested GitHub organization login, or `null` to clear.
- `repository`: `all` or an exact `owner/repository` in that organization.
  Prefer IDs in the queue's `repositories` list when available.
- `attention`: `all` for the whole organization, `mine` for the user's work,
  or `review` for first reviews and re-reviews requested from the user.
- `days`: 7, 14, or 30, affecting Merged history only. Open PRs have no age cutoff.

Organization changes reset the PR repository filter. These settings need no
local clones and do not change Activity/People filters, shared clone settings,
or the history snapshot. Read the queue again to verify saved query/revision.
On conflict, reconcile the requested change with its latest state.

The active PR view refreshes a newly selected organization and refreshes on
activation, using `refresh_pull_requests` without collecting Git history.
Check queue progress and watch an in-flight refresh instead of duplicating it.
If fresh collection is needed headlessly, collect once with a 150-second tool
timeout and report coverage separately from a successful settings save.
Honor a request to save without collecting. If the PR view is active, ask the
user to leave it before changing organization so its automatic refresh does
not contradict that request; the update tool cannot switch their active tab.

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

Saving these sources clears the configured-source collection, not organization
PR settings. Verify with `list_sources`. On conflict, reread and reconcile.
For fresh history, call `refresh_sources` once unless `read_board` shows an
in-flight history refresh; allow up to 150 seconds and report coverage gaps.
Honor an explicit request to save without collecting.

## Activity/People viewing settings

Call `read_board`, then `update_board` with that board's current
`expected_revision` and only requested fields: `days` (7 or 14), `repository`
(`all` or an ID from `list_sources`), and `compare` (boolean). Verify the
resulting query and revision; reconcile conflicts against current state.
These viewing changes do not collect data, change sources, or alter PR scope.

## Limits

Read/update tools do not switch the active tab. They do not configure global
viewing defaults, refresh cadence, authentication, credentials, reviewer
impersonation, or contributor/team identity mappings. Explain unsupported
requests rather than editing code, host configuration, credentials, or clones
as a workaround. Configuration help authorizes only the requested settings.
