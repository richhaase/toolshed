---
name: kb-setup
description: Deprecated compatibility alias for Memento setup. Set up and scaffold a personal Memento repository while preserving old kb setup triggers.
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

# KB Setup (Deprecated Memento Alias)

`kb` has been renamed to **Memento**. This compatibility skill preserves the
old `/kb-setup` entrypoint and old "kb setup" trigger language.

Use the canonical workflow in:

`../../../memento/skills/memento-setup/SKILL.md`

Follow that file exactly. Keep old `KB_ROOT` and `.kb-root` configurations
working through the compatibility root scripts, but prefer `MEMENTO_ROOT` and
`.memento-root` in new guidance.
