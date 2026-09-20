# <img src="assets/icon.png" width="64" height="64" align="middle" alt=""> Actuary — Skill Design Audit

Actuary assesses whether Agent Skills are well written, structured, portable,
and designed for reliable performance. It audits a single skill, a plugin, or
an entire marketplace across the portable Agent Skills specification and
named Claude and Codex profiles.

## Using it

After [installing the plugin](../../README.md#installation), ask:

```text
Audit the skills in this plugin.
Check this SKILL.md against agentskills best practices.
Triage every skill in the toolshed marketplace.
```

The `skill-audit` skill accepts a target path, `--quick-wins-only` for a
prioritized summary, and `--privacy` for an additional privacy review. With
no target path, it audits the current working directory.

## What the report covers

- **L1:** portable specification defects.
- **Harness profiles:** Claude and Codex compatibility and discovery concerns.
- **L2:** deterministic structural measurements.
- **L3:** ranked findings about writing, organization, and likely performance.

Actuary reads the target without executing or modifying it. The report
assesses design quality; it does not establish whether the skill accomplishes
the user's task or certify release readiness.

Node.js is required for the bundled deterministic analyzer. See
[skill-audit](skills/skill-audit/SKILL.md) for the full workflow.
