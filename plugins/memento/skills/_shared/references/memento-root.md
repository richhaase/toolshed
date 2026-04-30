# Memento root resolution

Every Memento skill operates against a configured Memento data root, not the
caller's current repo. Resolve the root before doing anything else, then use
absolute paths or the bundled helper scripts for filesystem and git work.

## Resolve the root

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
```

Resolution order (see `../_shared/scripts/memento-root --help`):

1. `MEMENTO_ROOT` environment variable
2. nearest `.memento-root` file walking upward from the current directory
3. current directory, if it already looks like a Memento (`sources/`,
   `wiki/`, and `AGENTS.md` all present)

The script exits non-zero with a clear message when no root is configured.

## Run commands against the root

```bash
../_shared/scripts/memento-run <command>          # cd to root, exec command
git -C "$MEMENTO_ROOT" <subcommand>               # git operations
```

Read and write files using absolute paths under `MEMENTO_ROOT`. Script paths
in this guide are shown relative to a skill's `SKILL.md`; if your shell is in
another directory, invoke the same scripts by absolute path.

## Path conventions

All Memento paths in skill instructions (`sources/`, `wiki/`, `private/`,
`outputs/`, `AGENTS.md`) are interpreted as relative to `MEMENTO_ROOT`, never
the caller's current working directory.
