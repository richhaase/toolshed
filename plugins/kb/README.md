# kb — Deprecated Memento Compatibility Plugin

`kb` has been renamed to **memento**.

This directory remains to preserve existing install paths, skill names, and root
configuration:

- `plugins/kb/skills` still exposes the old skill names such as `compile`,
  `fin`, `tasks`, `research`, `health-check`, and `kb-setup`.
- `KB_ROOT` and `.kb-root` still resolve a data root.
- New workflows are routed to the canonical implementation in
  `plugins/memento/`.

Prefer new installs and docs that use:

```bash
MEMENTO_ROOT=/path/to/memento
```

or a project marker:

```text
.memento-root
```

Use `plugins/memento/README.md` for the canonical workflow documentation.
