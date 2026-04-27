---
name: health-check
description: Deprecated kb compatibility alias for Memento health-check. Audit source status, staleness, contradictions, gaps, private leakage, and L1 freshness.
argument-hint: "[triage|embed]"
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Skill, Agent]
---

# Health Check (Deprecated KB Alias)

`kb` has been renamed to **Memento**. This compatibility skill preserves the
old `/health-check` entrypoint for existing `kb` installs.

Use the canonical workflow in:

`../../../memento/skills/health-check/SKILL.md`

Follow that file exactly. Keep old `KB_ROOT` and `.kb-root` configurations
working through the compatibility root scripts, but prefer `MEMENTO_ROOT` and
`.memento-root` in new guidance.
