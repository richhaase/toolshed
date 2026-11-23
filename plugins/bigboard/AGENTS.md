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
- Activity and People share a board's repository and date filters. Each board
  has its own saved filters. All boards use the same configured source
  repositories. Native repository selection import is read-only.
- Git collection reads existing clones and remote-tracking default branches.
  Never fetch or modify branches, the index, the working tree, Git config, or
  repository maintenance state.
- Keep board calculations in `src/projection.ts`, shared by the server and the
  panel's embedded-history fallback, so both produce the same results. Never
  embed clone paths or file lists in the panel page.
- Preserve cancellation, contributor identity rules, honest
  stale or partial coverage, and snapshot-bound evidence paging. Update affected
  projections and tests when changing data models.
- Activity and People use manual source refreshes. Bind selected intervals and
  people to the board's current snapshot when querying evidence.
