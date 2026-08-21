---
name: refresh-actuary-criteria
description: >
  Refresh the actuary skill-audit rubric by diffing pinned upstream sources
  against current HEAD. Use when the user says "refresh actuary criteria",
  "update audit rules", "is criteria.md stale", "check actuary drift", or
  is preparing a release of the actuary plugin and wants to verify the
  rubric is current. Toolshed-local — not exported to the marketplace.
  Reads upstream, diffs against the git SHAs and arXiv version pins in
  criteria.md, and proposes specific edits for human review. Never auto-applies bulk
  changes; every rule add/remove is surfaced for approval.
allowed-tools: Read Edit WebFetch Bash
---

# Refresh actuary criteria

`plugins/actuary/skills/skill-audit/references/criteria.md` is curated
on top of upstream guidance. This skill answers "is it still current?"
by fetching the pinned sources at HEAD and proposing edits.

## Sources to check

The criteria.md Sources block names four source tiers:

1. **agentskills/agentskills repo** — primary spec + best-practices.
   Pinned by SHA in criteria.md's Sources table.
2. **anthropics/skills skill-creator** — co-primary for L3 craft rules.
   GitHub-hosted, pinned by blob SHA in criteria.md's second Sources
   table.
3. **arXiv papers** — empirical grounding for the L3 "Skill mechanisms"
   subsection and the L2 size-threshold note. Pinned by arXiv version
   in `Pinned to arXiv \`NNNN.NNNNNvK\`` blocks. Versions are
   immutable; drift means a newer version was published (Step 2.5).
4. **Anthropic platform docs page** — co-primary for L3 craft rules.
   A web page with no SHA to pin; drift is only detectable by
   re-reading it, so Step 4 runs on every full refresh regardless of
   what the SHA comparison finds.

Cursor and OpenAI material was reviewed but isn't pinned; the criteria
cite them inline only at the rules they sourced. Re-check those pages
only if you suspect rule drift.

## Procedure

### Step 1: Read the current pin

Read `plugins/actuary/skills/skill-audit/references/criteria.md` and
extract the pinned refs + per-file blob SHAs from both Sources tables
(`agentskills/agentskills` and `anthropics/skills`) plus the pinned
arXiv versions from the `Pinned to arXiv` blocks. These are the anchor
points.

### Step 2: Fetch upstream state

Resolve `gh` first — the Bash tool runs in a non-interactive shell that
may not have Homebrew's PATH on macOS. Use `$GH` for every subsequent
`gh` invocation in this skill:

```bash
GH=$(command -v gh || for p in /opt/homebrew/bin/gh /usr/local/bin/gh; do
  [ -x "$p" ] && echo "$p" && break
done)
[ -n "$GH" ] || { echo "gh not found — install with brew install gh"; exit 1; }
```

Fetch HEAD:

```bash
HEAD=$($GH api repos/agentskills/agentskills/commits/main --jq .sha)
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
  sha=$($GH api "repos/agentskills/agentskills/contents/$path?ref=$HEAD" --jq .sha)
  echo "$path  $sha"
done
```

Also list the contents of `docs/skill-creation/` to detect new files
not currently pinned:

```bash
$GH api "repos/agentskills/agentskills/contents/docs/skill-creation?ref=$HEAD" --jq '.[].path'
```

Fetch the skill-creator blob SHA the same way — it is pinned in
criteria.md's second Sources table:

```bash
$GH api "repos/anthropics/skills/contents/skills/skill-creator/SKILL.md" --jq .sha
```

### Step 2.5: Check the arXiv paper pins

For each paper pinned in criteria.md's `Pinned to arXiv` blocks, fetch
the abstract page and read the submission history:

```
WebFetch https://arxiv.org/abs/<paper-id>
```

Compare the latest version in the submission history against the pinned
`vK`. arXiv versions are immutable, so a matching latest version means
that source is fully current — no content re-read needed. When a newer
version exists:

1. Fetch the revision's full text
   (`https://arxiv.org/html/<paper-id>v<latest>`).
2. Re-validate every criteria.md statement citing that paper. The cite
   trail is the parenthetical arXiv IDs (e.g. `(2608.14036)`) in the
   L3 "Skill mechanisms" subsection, the L2 size-threshold note, and
   the Sources block. Check each quoted statistic and finding against
   the revision.
3. Propose edits per Step 5, including the version-pin bump. A revised
   or withdrawn finding is a rule-semantics change, not a cosmetic
   bump — surface it explicitly, including any catalog key whose
   evidence base weakened.

### Step 3: Identify what changed

Compare the per-file blob SHAs from Step 2 against both pinned tables
in criteria.md. For any file whose blob SHA changed, fetch the new
content and the pinned content (swap in `repos/anthropics/skills` when
the moved blob is skill-creator's):

```bash
$GH api "repos/agentskills/agentskills/contents/$path?ref=$HEAD"        --jq .content | base64 -d > /tmp/upstream-new.mdx
$GH api "repos/agentskills/agentskills/contents/$path?ref=$PINNED_REF"  --jq .content | base64 -d > /tmp/upstream-pinned.mdx
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

### Step 4: Recheck the Anthropic platform docs page

This page has no SHA, so a quiet Step 2 says nothing about it. Run
this step on every full refresh:

```
WebFetch https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
```

(The old `docs.claude.com/en/docs/...` address 302-redirects here. If
this URL ever redirects again, follow it and update the pin in
criteria.md's Additional sources.)

Compare the rules the page publishes against the rules in criteria.md
that cite it. The cite trail in criteria.md (parenthetical "Anthropic
best-practices" / "skill-creator" annotations) tells you which rules
to re-validate. Flag any quoted text in criteria.md that no longer
appears upstream. skill-creator needs no content re-read here — its
blob SHA comparison in Step 2 already detects drift; re-read it only
when that SHA moved.

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
- **A quiet arXiv check is authoritative; a quiet web check is not.**
  arXiv versions are immutable, so "latest version equals pinned
  version" fully clears that source in Step 2.5. The Anthropic platform
  docs page has no such property and must be re-read on every full
  refresh.
- **A quiet SHA table doesn't cover the web page.** Step 2's SHA
  comparison short-circuits only the GitHub-pinned sources. The
  Anthropic platform docs page has no SHA, so skipping Step 4 because
  "nothing moved" means that source is never checked at all — the
  blind spot that once let this skill report "all current" for months
  without looking. Skip Step 4 only when the user explicitly asks for
  a SHA-only status check.
- **Anthropic platform docs are SPA-rendered.** `curl` returns the
  Next.js shell, not the rule text. Use `WebFetch` for those URLs;
  use `gh api` for the GitHub-hosted skill-creator SKILL.md.
- **The Cursor/OpenAI sources don't get auto-rechecked.** They're noted
  as inline cites at specific rules. Only re-read them if the user
  asks "are the OpenAI rules still current?" or similar.
