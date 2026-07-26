# toolshed

Canonical agent context for this repo, shared across Claude Code and Codex.
`CLAUDE.md` is a thin harness pointer that defers here.

## Repo purpose

Rich's personal Agent Skills toolkit, distributed to Claude Code and Codex
through harness-specific metadata. Treat it like dotfiles — updated when
Rich chooses, breaking changes are normal, no stability or compatibility
promises. The same skill bodies are exposed to both harnesses.

- `.claude-plugin/marketplace.json` — Claude Code marketplace metadata.
- `.agents/plugins/marketplace.json` — Codex marketplace metadata.
- `plugins/<name>/skills/<skill>/SKILL.md` — canonical portable skill bodies.
- `plugins/<name>/.claude-plugin/plugin.json` and
  `plugins/<name>/.codex-plugin/plugin.json` — per-harness plugin manifests.

Skills follow the [Agent Skills](https://agentskills.io) open format.

## Workflow

This repo and `~/src/dotfiles` are Rich's personal cross-machine tooling repos.
They do not use the normal PR workflow. When a fix is complete, verified, and
docs are current, commit directly and push the branch. Before every push, run
the repository validation and privacy gates explicitly; the pre-push hook is a
second line of defense, not the only place these checks run.

## Commands

```bash
claude plugin validate .                # Validate marketplace structure
claude plugin validate plugins/<name>   # Validate a single plugin
codex plugin marketplace add .          # Smoke-test Codex marketplace discovery
bash scripts/validate-manifests.sh       # Validate both harness surfaces + skills
node scripts/privacy-scan --self-test    # Prove privacy detectors still fire
node scripts/privacy-scan                # Scan the tracked public tree
```

## Adding a plugin

1. Create `plugins/<name>/` with a `.claude-plugin/plugin.json` manifest.
2. Add `.codex-plugin/plugin.json` for Codex.
3. Add skills as `skills/<skill-name>/SKILL.md` directories (per the
   [Agent Skills spec](https://agentskills.io/specification)).
4. Add entries to `.claude-plugin/marketplace.json` and
   `.agents/plugins/marketplace.json`.
5. Validate each harness surface where the CLI is available.

## Skill format

Each skill is a directory with a `SKILL.md` containing YAML frontmatter +
Markdown instructions:

- **Required frontmatter:** `name` (lowercase, hyphens, must match directory
  name), `description`.
- **Optional frontmatter:** `license`, `compatibility`, `metadata`,
  `allowed-tools`.
- **Optional directories:** `scripts/`, `references/`, `assets/`.
- Keep `SKILL.md` under 500 lines; move detailed reference material to
  `references/`.

## Authoring references

Beyond the [spec](https://agentskills.io/specification), the
[agentskills/agentskills](https://github.com/agentskills/agentskills) repo has
deeper author-facing guidance:

- [Best practices](https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/best-practices.mdx)
- [Optimizing descriptions](https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/optimizing-descriptions.mdx) — description quality drives whether a skill gets triggered
- [Evaluating skills](https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/evaluating-skills.mdx)
- [Using scripts](https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/using-scripts.mdx)
- [Reference SDK](https://github.com/agentskills/agentskills/tree/main/skills-ref)

## Editing plugin behavior

When you change anything inside a plugin directory (`plugins/<name>/SKILL.md`,
files under `plugins/<name>/skills/`, scripts, hooks, references, assets),
bump `version` in **both** harness manifests in lockstep:

- `plugins/<name>/.claude-plugin/plugin.json`
- `plugins/<name>/.codex-plugin/plugin.json`

Use the same version string in both files. Claude Code's plugin cache keys
off `.claude-plugin/plugin.json`; Codex keys off `.codex-plugin/plugin.json`.
Without a bump on either side, installed copies keep serving the old skill
bodies after `/plugin update` (Claude) or a Codex marketplace refresh.

If a plugin gains a new harness manifest later, this rule extends to it —
keep all per-harness `plugin.json` versions identical for a given release.

README and LICENSE edits don't need a bump.

### Local validation (enable once per clone)

`scripts/validate-manifests.sh` is the single source of truth for the
manifest/version/frontmatter/distribution checks. Pass `--base <git-ref>` to
also require a version bump for every plugin whose behavior changed since that
ref. CI runs it; the in-repo
`.githooks/pre-push` runs it locally when any `plugins/`, `.claude-plugin/`,
`.agents/plugins/`, or harness-local skill files are in the push. Enable hooks
once per clone:

```bash
git config core.hooksPath .githooks
```

The hook catches mistakes before they leave your machine, but does not replace
the explicit validation and privacy commands required by the workflow above.

## Current plugins

- **memento** — Memory-base workflows (memento-config, compile, health-check,
  save, ama, followups, promote). Seven-skill core: idempotent setup/config,
  sources -> wiki -> AGENTS.md hot set compilation, read-only
  cache/provenance/privacy diagnostics, passive session capture, active
  LLM-driven interview, queue review, and gated promotion to a marketplace git
  repo, defaulting to the Memento RSI target.
- **legate** — Retired delegated-work orchestration. Code is retained for
  history/reference, but the plugin is not installable from toolshed
  marketplace surfaces. Use harness-native background agents / agents view
  instead of Legate's tmux coordination layer.
- **actuary** — Audit and evaluate Agent Skills against agentskills.io spec
  and authoring best practices. First skill: `skill-audit` (read-only L1/L2/L3
  layered report). Designed to grow with additional evaluator skills.
- **steward** — Portable intent-and-assurance contracts for software work.
  Three separated roles: `frame` drafts and freezes explicitly approved
  Markdown tickets, `critique` independently challenges proposed tickets, and
  `assess` judges completed changes claim by claim against the frozen revision.
  A dependency-free local CLI owns the deterministic lifecycle; builders need
  only the ticket in their codebase.

## Portability rules

- Keep `SKILL.md` as the canonical workflow. Do not copy workflow details into
  harness manifests or install docs.
- Treat `CLAUDE.md` and `AGENTS.md` as harness-specific entrypoint files for
  the same conceptual context. In this repo, `AGENTS.md` is canonical and
  `CLAUDE.md` is a thin pointer to it.
- For Memento consumer repos, treat `AGENTS.md` as the canonical shared
  Memento context. `CLAUDE.md` should be a thin harness entrypoint that
  routes to it, not a duplicated copy of the same Memento state.
- Prefer generic wording in skills: "agent entrypoint" rather than only
  `CLAUDE.md`, unless the instruction is explicitly Claude-specific.
- Keep `memento` independent from retired `legate`; Memento should use
  harness-native background-agent primitives where available and degrade cleanly
  when no delegation surface exists.

## Public-repo hygiene

This is a public marketplace repo. Examples and fixtures must use
unmistakably synthetic placeholders, never real private data. Run privacy
checks before pushing new content to remote.
