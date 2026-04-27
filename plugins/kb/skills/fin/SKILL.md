---
name: fin
description: Deprecated kb compatibility alias for Memento fin. Finish a session by extracting useful data and persisting it to sources.
argument-hint: "[session-name|all] [ask]"
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Agent]
---

# Fin (Deprecated KB Alias)

`kb` has been renamed to **Memento**. This compatibility skill preserves the
old `/fin` entrypoint for existing `kb` installs.

Use the canonical workflow in:

`../../../memento/skills/fin/SKILL.md`

Follow that file exactly. Keep old `KB_ROOT` and `.kb-root` configurations
working through the compatibility root scripts, but prefer `MEMENTO_ROOT` and
`.memento-root` in new guidance.
