# BigBoard plugin

This directory owns the BigBoard MCP server, web app, and `bigboard:explore` and
`bigboard:configure` skills. The original native macOS app is archived in
[richhaase/bigboard](https://github.com/richhaase/bigboard); future development
lives here.
See the [plugin guide](README.md) for installation, data semantics, and the
actual desktop-host interaction checklist.

## Development and distribution

- Run Node commands here with `fnm exec` using `.node-version`.
- Keep `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `package.json`,
  and the lockfile version in step for each installable update.
- Rebuild and commit `bundle/server.cjs`, `bundle/board.html`, and bundled
  third-party licenses. Marketplace installation requires no compiler,
  dependency download, or install script.
- Run `fnm exec npm run check` to typecheck, build, and test the bundled stdio
  server and rendered app. Record actual desktop-host verification separately
  from protocol and rendered-bridge tests; claim a rendered host outcome only
  when observed.
- Keep skills named `bigboard:explore` and `bigboard:configure`; custom skill
  title overrides would hide the generated namespace labels.
- Keep the packaged icon wired into supported Codex plugin/skill metadata and
  embedded in the MCP app and server metadata. See the [desktop icon guide](../../docs/icon-prompts.md#desktop-icon-surfaces)
  for host limitations; metadata support alone does not prove desktop rendering.

## Data and access

- Preserve the existing `bigboard-mcp-app` state directory under
  `$XDG_STATE_HOME` or `~/.local/state`; moving the plugin must not reset saved
  sources, collected evidence, or boards. `BIGBOARD_STATE_DIR` supports isolated
  tests. Native app state is separate.
- Activity/People share configured history sources and retain independent
  board filters. Native repository selection import is read-only.
- Each board has a separate organization PR query and PR revision/snapshot.
  The queue needs no local clones; Open has no age cutoff and defaults to the
  whole organization with personal action groups first. Classify and sort the
  complete collected inventory before paging, retain drafts/authored fallbacks,
  and disclose missing review history or checks rather than inferring no action.
- Git collection reads existing clones and remote-tracking default branches.
  Never fetch or modify branches, the index, the working tree, Git config, or
  repository maintenance state.
- Obtain GitHub API access only through GitHub CLI authentication. Keep tokens
  in memory; never persist them in source, state, or tool output.
- Preserve cancellation, account access invalidation, identity rules, honest
  stale or partial coverage, and snapshot-bound evidence paging. Update affected
  projections and tests when changing data models.
- Activating Pull requests refreshes GitHub only and joins an existing PR
  refresh. Its progress and collection must not replace Activity's snapshot or
  selected interval. Organization changes refresh the active PR view; sorting,
  selection, paging, and ordinary polls do not collect. Activity and People use
  manual history refreshes. Keep agent queries and selection context bound to
  the correct independent query, snapshot, account, and exact PR head.
