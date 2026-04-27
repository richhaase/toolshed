---
name: compile
description: Deprecated kb compatibility alias for Memento compile. Compile wiki pages from active sources, ignoring superseded or archived sources for current synthesis, then refresh AGENTS.md.
argument-hint: "[full|<topic>]"
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Agent]
---

# Compile (Deprecated KB Alias)

`kb` has been renamed to **Memento**. This compatibility skill preserves the
old `/compile` entrypoint for existing `kb` installs.

Use the canonical workflow in:

`../../../memento/skills/compile/SKILL.md`

Follow that file exactly. Keep old `KB_ROOT` and `.kb-root` configurations
working through the compatibility root scripts, but prefer `MEMENTO_ROOT` and
`.memento-root` in new guidance.
