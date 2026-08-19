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

The Step -1 output guard has already required a clean Git index and clean
`AGENTS.md` and `wiki/` paths. Unrelated unstaged or untracked paths are allowed.
Existing append-only `sources/eval/runs/` telemetry is snapshot-preserved and
intentionally adopted into the compile commit. Do not skip that preflight; it is
what makes the scoped directory pathspecs below safe.

1. Stage compile output:
   ```bash
   git -C "$MEMENTO_ROOT" add wiki/ AGENTS.md sources/eval/runs/
   ```
   `sources/eval/runs/` is the only `sources/` path compile stages; it records
   Step 7.5 verdicts and may contain append-only telemetry left by an earlier
   interrupted run. Compile requires canonical `AGENTS.md`; migrate old
   `CLAUDE.md`-only Mementos with `memento-config` before running it.
2. Verify the staged scope before committing:
   ```bash
   invalid=""
   while IFS= read -r path; do
     case "$path" in
       AGENTS.md|wiki/*|sources/eval/runs/*) ;;
       *) invalid+="${invalid:+, }$path" ;;
     esac
   done <<< "$(git -C "$MEMENTO_ROOT" diff --cached --name-only)"
   if [[ -n "$invalid" ]]; then
     echo "compile: refusing commit; unexpected staged paths: $invalid" >&2
     exit 1
   fi
   ```
   If this fails, do not commit or clean up `COMPILE_SNAPSHOT`; report the
   snapshot path so the user can inspect or restore the run.
3. Check whether anything is actually staged:
   ```bash
   git -C "$MEMENTO_ROOT" diff --cached --quiet
   ```
   If exit code is `0` (no staged changes), skip the commit — there is nothing
   to record. Report `commit: skipped (no changes)`.
4. Commit. Subject and body together replace the old HTML compile-run comment.
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
5. After a successful commit, or a not-a-repo/no-changes skip, remove the
   successful run's snapshot:
   ```bash
   ../_shared/scripts/compile-output-guard cleanup --snapshot "$COMPILE_SNAPSHOT"
   ```
6. Never push. The skill only commits locally — pushing is the user's call,
   not the skill's.

## Failure handling

- If `git add` or `git commit` fails for an unexpected reason (hooks, locked
  index, etc.), surface the exact stderr to the user and stop. Do not retry,
  do not `--no-verify`, do not amend prior commits. Keep `COMPILE_SNAPSHOT` and
  report its path; it is the recovery point for the partially completed run.
- Pre-commit hook failure means the commit did not happen — fix the underlying
  issue, re-stage, and create a new commit. Never amend.
