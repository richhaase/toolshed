---
name: refresh-actuary-criteria
description: >
  Refresh the actuary skill-audit rubric by diffing pinned upstream sources
  against current HEAD. Use when the user says "refresh actuary criteria",
  "update audit rules", "is criteria.md stale", "check actuary drift", or
  is preparing a release of the actuary plugin and wants to verify the
  rubric is current. Toolshed-local — not exported to the marketplace.
  Reads upstream, diffs against the SHAs pinned in criteria.md, and
  proposes specific edits for human review. Never auto-applies bulk
  changes; every rule add/remove is surfaced for approval.
allowed-tools: [Read, Edit, WebFetch, Bash]
---

# Refresh actuary criteria

`plugins/actuary/skills/skill-audit/references/criteria.md` is curated
on top of upstream guidance. This skill answers "is it still current?"
by fetching the pinned sources at HEAD and proposing edits.

## Sources to check

The criteria.md Sources block names two source tiers:

1. **agentskills/agentskills repo** — primary spec + best-practices.
   Pinned by SHA in criteria.md's Sources table.
2. **Anthropic platform docs + skill-creator** — co-primary for L3
   craft rules. Not SHA-pinned (web pages); compare by re-reading.

Cursor and OpenAI material was reviewed but isn't pinned; the criteria
cite them inline only at the rules they sourced. Re-check those pages
only if you suspect rule drift.

## Procedure

### Step 1: Read the current pin

Read `plugins/actuary/skills/skill-audit/references/criteria.md` and
extract the pinned `agentskills/agentskills` ref + per-file blob SHAs
from the Sources table. These are the anchor points.

### Step 2: Fetch upstream state

```bash
HEAD=$(gh api repos/agentskills/agentskills/commits/main --jq .sha)
echo "Upstream HEAD: $HEAD"
```

For each path listed in criteria.md's Sources table, fetch the current
blob SHA:

```bash
for path in \
  docs/specification.mdx \
  docs/skill-creation/best-practices.mdx \
  docs/skill-creation/optimizing-descriptions.mdx \
  docs/skill-creation/evaluating-skills.mdx \
  docs/skill-creation/using-scripts.mdx \
  docs/skill-creation/quickstart.mdx \
  docs/client-implementation/adding-skills-support.mdx; do
  sha=$(gh api "repos/agentskills/agentskills/contents/$path?ref=$HEAD" --jq .sha)
  echo "$path  $sha"
done
```

Also list the contents of `docs/skill-creation/` to detect new files
not currently pinned:

```bash
gh api "repos/agentskills/agentskills/contents/docs/skill-creation?ref=$HEAD" --jq '.[].path'
```

### Step 3: Identify what changed

Compare the per-file blob SHAs from Step 2 against the pinned table in
criteria.md. For any file whose blob SHA changed, fetch the new content
and the pinned content:

```bash
gh api "repos/agentskills/agentskills/contents/$path?ref=$HEAD"        --jq .content | base64 -d > /tmp/upstream-new.mdx
gh api "repos/agentskills/agentskills/contents/$path?ref=$PINNED_REF"  --jq .content | base64 -d > /tmp/upstream-pinned.mdx
diff -u /tmp/upstream-pinned.mdx /tmp/upstream-new.mdx
```

Read the diff with intent. We are not mirroring upstream — we are
auditing whether the curated `criteria.md` still reflects what upstream
publishes. For each diff, ask:

- **Did a rule change semantics?** (e.g., the 1024-char description
  ceiling shifted to 2048). Update the corresponding rule in criteria.md.
- **Was a rule added?** Propose a new rule key + catalog entry.
- **Was a rule removed?** Propose deprecating the catalog entry, but
  preserve it with a `(deprecated, kept for legacy skills)` note unless
  upstream explicitly forbids the old behavior.
- **Cosmetic/prose-only change?** Just bump the SHA in the Sources table.

### Step 4: Recheck Anthropic platform docs

The platform pages aren't SHA-pinned. Re-read them with WebFetch:

```
WebFetch https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices
WebFetch https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md
```

Compare the rules they publish against the rules in criteria.md that
cite them. The cite trail in criteria.md (parenthetical "Anthropic
best-practices" / "skill-creator" annotations) tells you which rules
to re-validate. Flag any quoted text in criteria.md that no longer
appears in the upstream page.

### Step 5: Propose edits

Produce a **proposal**, not a unilateral rewrite. For each finding,
state:

- The change (rule key added / removed / semantics-shifted / SHA bumped).
- The upstream evidence (1–2 lines quoted with source URL or path).
- The exact lines in criteria.md to edit, in `old_string` / `new_string`
  shape so the user can approve them as `Edit` calls.

If the only change is "blob SHAs moved but content equivalent," propose
just the SHA-table refresh. Don't make work where there isn't any.

### Step 6: Apply approved edits

Once the user approves the proposal, apply each edit with the `Edit`
tool. Update the pinned SHA at the top of the Sources table and the
per-file blob SHAs in the same edit set. Stop after the edit batch —
do not commit; the user controls git.

## Gotchas

- **This skill never edits anything outside `plugins/actuary/skills/skill-audit/`.**
  It exists to maintain that one rubric.
- **No auto-apply on bulk diffs.** Even if upstream rewrites every file,
  the human signs off each rule change. Mass criteria edits without
  judgment is exactly the failure mode the skill exists to prevent.
- **Don't re-fetch every run unless asked.** If the user just wants a
  status check, Step 2's SHA comparison is enough — skip Steps 4–5
  unless a SHA actually moved.
- **Anthropic platform docs are SPA-rendered.** `curl` returns the
  Next.js shell, not the rule text. Use `WebFetch` for those URLs;
  use `gh api` for the GitHub-hosted skill-creator SKILL.md.
- **The Cursor/OpenAI sources don't get auto-rechecked.** They're noted
  as inline cites at specific rules. Only re-read them if the user
  asks "are the OpenAI rules still current?" or similar.
