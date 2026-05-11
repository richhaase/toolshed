# Commit flow

How `/compile` commits its output as the final step. The compile run is not
finished until its output is committed — the git log is the durable record of
what each compile pass did, replacing the inline `<!-- Compile run ... -->` log
that earlier versions wrote into `INDEX.md`.

## Detect the git context

```bash
git -C "$MEMENTO_ROOT" rev-parse --is-inside-work-tree 2>/dev/null
```

- Output `true` → in a git working tree, proceed with the commit flow below.
- Anything else (non-zero exit, empty output) → no git context. Skip this step
  silently and report `commit: skipped (not a git repo)` in the user-facing
  summary. Do **not** error out; `/compile` must work in non-git scratch dirs.

## Commit flow (when in a git repo)

1. Stage compile output:
   ```bash
   git -C "$MEMENTO_ROOT" add wiki/ AGENTS.md
   ```
   In a legacy repo without `AGENTS.md`, stage `wiki/` plus the fallback
   `CLAUDE.md` entrypoint you updated.
2. Check whether anything is actually staged:
   ```bash
   git -C "$MEMENTO_ROOT" diff --cached --quiet
   ```
   If exit code is `0` (no staged changes), skip the commit — there is nothing
   to record. Report `commit: skipped (no changes)`.
3. Commit. Subject and body together replace the old HTML compile-run comment.
   - **Subject** (≤ 72 chars): `compile: update wiki — <brief synthesis>`
     where `<brief synthesis>` is the one-line theme of the run.
   - **Body** (multi-line): the synthesis that previously went in the inline
     HTML comment — sources processed, pages updated, hot-set
     promotions/demotions, any sources that couldn't be processed. Use a
     HEREDOC to preserve formatting:
     ```bash
     git -C "$MEMENTO_ROOT" commit -m "$(cat <<'EOF'
     compile: update wiki — <brief synthesis>

     Sources processed (N): <one-line list or grouped summary>
     Pages updated (N): <one-line list>
     Hot set: <promoted X, demoted Y, no change>
     Notes: <anything that couldn't be processed, or "none">
     EOF
     )"
     ```
4. Never push. The skill only commits locally — pushing is the user's call,
   not the skill's.

## Failure handling

- If `git add` or `git commit` fails for an unexpected reason (hooks, locked
  index, etc.), surface the exact stderr to the user and stop. Do not retry,
  do not `--no-verify`, do not amend prior commits.
- Pre-commit hook failure means the commit did not happen — fix the underlying
  issue, re-stage, and create a new commit. Never amend.
