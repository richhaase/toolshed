---
name: refresh-actuary-criteria
description: >
  Refresh the Actuary design-audit rubric by comparing its pinned evidence and
  live harness documentation with current upstream sources. Use when the user
  asks to refresh Actuary criteria, check rubric drift, verify evidence pins,
  or prepare an Actuary release. Toolshed-local and proposal-first: surface
  rule changes for review rather than bulk-applying upstream prose.
allowed-tools: Read Edit WebFetch Bash
---

# Refresh Actuary criteria

Actuary separates its compact operational rubric from source detail:

- `plugins/actuary/skills/skill-audit/references/criteria.md` — rules applied
  during ordinary audits.
- `plugins/actuary/skills/skill-audit/references/evidence.md` — repository,
  paper, and live-documentation provenance.

This workflow checks whether both remain current without turning Actuary into a
mirror of upstream documentation.

## Sources

Read `evidence.md` and extract:

1. the pinned `agentskills/agentskills` commit and per-file blob SHAs;
2. the pinned `anthropics/skills` skill-creator blob;
3. the pinned arXiv paper versions;
4. the live Anthropic and OpenAI skill-documentation URLs.

Bind the full agentskills commit to `PINNED_REF` before comparing content.

## Procedure

### 1. Fetch repository state

Resolve `gh` explicitly because non-interactive macOS shells may omit
Homebrew's path:

```bash
GH=$(command -v gh || for p in /opt/homebrew/bin/gh /usr/local/bin/gh; do
  [ -x "$p" ] && echo "$p" && break
done)
[ -n "$GH" ] || { echo "gh not found"; exit 1; }
```

Fetch the current agentskills HEAD and blob SHA for every path in evidence.md.
Also list `docs/skill-creation/` so newly added authoring guidance is visible.

```bash
HEAD=$($GH api repos/agentskills/agentskills/commits/main --jq .sha)
for path in \
  docs/specification.mdx \
  docs/skill-creation/best-practices.mdx \
  docs/skill-creation/optimizing-descriptions.mdx \
  docs/skill-creation/evaluating-skills.mdx \
  docs/skill-creation/using-scripts.mdx \
  docs/skill-creation/quickstart.mdx \
  docs/client-implementation/adding-skills-support.mdx; do
  $GH api "repos/agentskills/agentskills/contents/$path?ref=$HEAD" --jq .sha
done
$GH api "repos/agentskills/agentskills/contents/docs/skill-creation?ref=$HEAD" --jq '.[].path'
$GH api repos/anthropics/skills/contents/skills/skill-creator/SKILL.md --jq .sha
```

### 2. Inspect changed pinned files

For each changed blob, fetch both versions and diff them. Use unique temporary
paths so concurrent runs do not collide:

```bash
$GH api "repos/agentskills/agentskills/contents/$path?ref=$HEAD" --jq .content | base64 -d > "/tmp/actuary-new.$$.mdx"
$GH api "repos/agentskills/agentskills/contents/$path?ref=$PINNED_REF" --jq .content | base64 -d > "/tmp/actuary-pinned.$$.mdx"
diff -u "/tmp/actuary-pinned.$$.mdx" "/tmp/actuary-new.$$.mdx"
```

Classify each change:

- specification or documented behavior changed;
- guidance was added or removed;
- wording moved without changing meaning;
- a new source file may affect the rubric.

Update the compact criterion only when the applied rule changes. Cosmetic source
movement needs only an evidence-pin refresh.

### 3. Check paper versions

Open each pinned arXiv abstract page and compare the latest submission version
with evidence.md. Matching versions need no content reread because arXiv
versions are immutable.

When a newer version exists, recheck every statistic and mechanism summarized
in evidence.md, then identify the exact operational rules in criteria.md whose
support strengthened, weakened, or changed.

### 4. Recheck live harness documentation

Always read both pages during a full refresh:

```text
https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
https://learn.chatgpt.com/docs/build-skills
```

The pages have no immutable SHA. Compare them with evidence.md's harness
summaries and criteria.md's named profiles. In particular, verify Claude's
frontmatter constraints and Codex's initial skill-list budget, description
shortening, and omission behavior.

Recheck other unpinned prompting sources only when their specific criterion is
disputed or the user requests a complete source review.

### 5. Propose edits

Do not bulk-apply upstream changes. For each proposed edit, provide:

- affected rule key or evidence statement;
- one or two lines of upstream evidence with its URL or path;
- the exact `old_string` and `new_string` in criteria.md or evidence.md;
- whether the change affects audit behavior or only refreshes provenance.

If nothing changed, report that each pin and live page was checked. A quiet Git
SHA comparison does not clear the live documentation.

### 6. Apply approved edits

After approval, update the operational rule and its evidence together. Keep
source detail in evidence.md rather than expanding criteria.md. Run Actuary's
contract and calibration tests, then stop without committing unless the user
has separately authorized repository publication.

## Gotchas

- This skill edits only the Actuary skill directory.
- Never infer a rule change from a large upstream rewrite without reading the
  semantic diff.
- Use `gh api` for GitHub content and a web reader for rendered documentation.
- Do not let vendor-only preferences become portable L1 requirements.
- Paper associations support design findings; they do not prove an audited
  skill succeeds or fails its task.
