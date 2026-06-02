---
name: save
description: Save a session by extracting useful data, persisting it to sources, and closing down. Works on Legate delegated handles and the main conversation. Use when wrapping up any session ("we're done", "wrap up", "save", "close out"), when closing delegated work, or when the user wants session context captured. Also triggers on "session-log", "log this", "anything to capture?". Default action is immediate; pass `ask` to review the capture plan before writing.
argument-hint: "[session-name|all] [ask]"
user-invocable: true
allowed-tools: Read Write Edit Glob Grep Bash Agent Skill
---

# Save

Save a session. Extract anything worth keeping, persist it, close down.

Works on two kinds of sessions:

1. **Legate delegated handles** — debrief/log the delegated work, extract value, write to sources, then stop/close the handle when supported.
2. **Main conversation** — scan the current conversation, extract value, write to sources, commit.

## Gotchas

- **No arguments = save the current (main) conversation.** Do NOT check on,
  debrief, or interact with Legate handles. Delegated work is independent. Touch
  them only if a name is passed or `all` is given.
- **Default mode writes most categories immediately** — decisions, research,
  analyses, private notes, durable knowledge. `ask` makes the whole plan
  approval-gated. Follow-ups are different (see next bullet).
- **Empty capture plan ⇒ stop.** Don't create empty files, don't commit, don't
  emit a "nothing to do" commit. Print the reason and exit.
- **The Memento is a knowledge base, not a task tracker.** Real commitments
  belong in the user's issue tracker (Jira, Linear, GitHub issues), not in
  markdown. `/save` does not create tasks. The only commitment-shaped output
  is a follow-up (see next bullet), and the bar is high.
- **Follow-ups are last-resort capture, always confirmed, capped at 1 per
  session.** A follow-up only earns its place if the user would re-read it
  within a week and act on it. Any item that fails that test belongs in the
  issue tracker, in `sources/notes/` as durable knowledge, in a session
  decision file, or nowhere at all. Default mode confirms the proposed
  follow-up with the user before writing — no implicit creation. See Step 4.
- **Durable knowledge goes to `sources/notes/`, not follow-ups.** "Worth not
  losing" alone is not the follow-up bar. If the value is the information
  itself rather than the open loop, write a note — `/compile` folds it into
  the wiki.
- **Sensitive observations route to `private/`, never `sources/` or `wiki/`.**
  The Entity Types registry decides which entity types have this boundary.
- Don't capture content that's already persisted (PRs, issue trackers, files
  written during the session).

## Memento root

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
```

See `../_shared/references/memento-root.md` for the full resolution contract.
All `sources/`, `outputs/`, `private/`, and context files below are relative to
`MEMENTO_ROOT`.

## Arguments

Arguments are passed as: $ARGUMENTS

Target selector (pick one):

- No arguments → save the current (main) conversation
- A Legate handle name (e.g., `pr-52`, `research-auth`) → save that delegated handle
- `all` → save all open Legate handles, then the main conversation

Mode modifier (optional, combines with any target):

- `approve` (or omitted) → **default.** Extract → write → commit → report. No prompt.
- `ask` → Extract → show capture plan → wait for user approval → write → commit → report.

Examples: `save`, `save ask`, `save pr-52`, `save pr-52 ask`, `save all`, `save all ask`.

## Step 0: Determine the target and mode

**No arguments = save the main conversation in default (no-approval) mode. Do NOT check on, debrief, or interact with Legate handles.** Delegated work keeps running. Only touch it if explicitly named or `all` is passed.

Parse `$ARGUMENTS`: the mode is `ask` if the tokens contain `ask`; otherwise `approve` (default). The remaining token (if any) is the target — a Legate handle name or `all`. Remember the mode for Step 4.

If a Legate handle is given, resolve it from conversation history first. For
tmux-backed legacy handles, verify the window exists:

```bash
tmux show-option -wv -t "<name>" @legate-managed 2>/dev/null
```

If `all`, collect known Legate handles from conversation history. Also list
tmux-managed windows as a compatibility fallback:

```bash
for w in $(tmux list-windows -F '#{window_name}'); do
  managed=$(tmux show-option -wv -t "$w" @legate-managed 2>/dev/null)
  if [ "$managed" = "true" ]; then
    desc=$(tmux show-option -wv -t "$w" @legate-description 2>/dev/null)
    echo "$w: $desc"
  fi
done
```

## Step 1: Gather session content

### For a Legate handle

Start with what was asked. Prefer Legate's own status surfaces:

1. Invoke `legate:debrief <handle>` via the Skill tool for the task arc.
2. Invoke `legate:logs <handle>` via the Skill tool when raw detail is needed.
3. For tmux-backed legacy handles, fall back to the original pane capture flow:

```bash
cat /tmp/legate-<name>.md 2>/dev/null
```

If the file is gone, fall back to the tags:

```bash
tmux show-option -wv -t "<name>" @legate-description
tmux show-option -wv -t "<name>" @legate-source
```

Then capture the tail for tmux handles:

```bash
tmux capture-pane -t "<name>" -p -S -80
```

Read the tail from the bottom up. Skip blank lines, prompt lines, and tool-call noise
(file reads, grep output, diff hunks, progress bars). Find the agent's last substantive
prose block — that's the conclusion. Compare it against the context brief to understand
what was asked, what was delivered, and what's worth extracting.

If the conclusion references specific deliverables (PRs opened, files written, commits
made), check those directly rather than trying to reconstruct them from scrollback.

Only escalate to a larger capture if the tail genuinely doesn't have enough to assess
what happened:

```bash
tmux capture-pane -t "<name>" -p -S -200
```

### For the main conversation

Scan the current conversation history. You have full access to it — no tmux capture needed.

## Step 2: Read Entity Types registry

Read the `## Entity Types` section from canonical `AGENTS.md`. In legacy repos
without `AGENTS.md`, fall back to `CLAUDE.md`. Use it to understand:
- Which entity types have `private_notes: yes` — observations about these entities
  route to `private/` instead of `sources/`.
- The filename pattern for private notes (e.g., `private/firstname-lastname.md`).

This enables entity-aware routing in Step 3.

## Step 3: Extract value

Review the session content and identify items in these categories:

| Category | What to look for | Destination |
|----------|-----------------|-------------|
| **Decisions** | Choices made, direction set, options ruled out | `sources/sessions/YYYY-MM-DDTHHmmss-topic.md` |
| **Research** | New information, findings worth preserving | `sources/sessions/YYYY-MM-DDTHHmmss-topic.md` |
| **Durable knowledge** | A fact, clarification, pattern, or lesson worth folding into the wiki | `sources/notes/YYYY-MM-DD-topic.md` |
| **Analyses** | Substantive ad-hoc analyses, trade-off evaluations | `outputs/reports/YYYY-MM-DDTHHmmss-topic.md` |
| **Private notes** | Observations about entities with `private_notes: yes` | `private/<filename-pattern>` (append) |
| **Follow-up** *(at most one per session, user-confirmed)* | A single re-read-and-act-on-it-within-a-week item that genuinely cannot live anywhere else | `sources/followups/topic-slug.md` |
| **Follow-up updates** | New context on existing follow-ups the user is still triaging | Update existing `sources/followups/*.md` |
| **Trajectory** *(telemetry — every substantive session)* | Structured record of the run: task, outcome, skills/tools used, lessons, artifacts | `sources/trajectories/YYYY-MM-DD/<run-id>.md` |

Most sessions produce 0-2 value items (and zero follow-ups — that is the
expected outcome). The **trajectory record is different**: emit one per
substantive session as structured telemetry, regardless of whether there were
value items. It is the substrate the future learning loop (Reflexion lessons,
trajectory clustering, SkillOpt) consumes — see "Trajectory channel" below.

### Where commitments go

`/save` does not create tasks. A real commitment — "I am driving this to
done" — lives in the user's issue tracker (Jira, Linear, GitHub issues),
not in a markdown file. If the session surfaced something the user
committed to, surface it back as a one-liner ("Worth filing in Jira: …")
and let the user file it. Do not write `sources/tasks/`.

### The follow-up bar

A follow-up is a costly capture. Every accumulated follow-up has to be
re-read on the next triage walk. Apply the bar before proposing one:

1. **Would the user re-read this within a week and act on it?** Not "is
   this interesting." Not "might someone want to know." If the answer is
   not a confident yes, it is not a follow-up.
2. **Does it have to be a follow-up?** If the value is the information,
   route to `sources/notes/` so `/compile` folds it into the wiki. If it
   is a commitment, surface for Jira. If it is sensitive entity context,
   route to `private/`. Follow-up is the last resort.
3. **Is there already an open follow-up on this topic?** If yes, update
   that file's `## Notes` rather than creating a new one.

Heuristics:
- "Worth tracking" → almost never a follow-up. Either note or nothing.
- "Open question waiting on me to chase down within the week" → follow-up.
- "Someone else owes me a reply" → follow-up (with `expires_at`).
- "I noticed a thing about the codebase" → note, or nothing.
- "Post-merge cleanup considerations" → almost never a follow-up; either
  a Jira ticket or it does not matter.

### Entity-aware routing

If the Entity Types registry defines entity types with `private_notes: yes`, check
whether any session content contains observations about those entities (e.g., coaching
notes, personal assessments, sensitive context). Route those to `private/` using the
configured filename pattern, not to `sources/`.

### What NOT to capture

- Things already written to files during the session
- Routine operations (git commands, file reads, debugging steps)
- Information already in the repo that hasn't changed

### Legate-specific patterns

Delegated work often produces specific kinds of value:

- **Research handles**: Capture findings into a dated session file under `sources/sessions/` if they aren't already persisted elsewhere.
- **Investigation handles**: Findings may warrant a research doc or analysis if substantive.
- **Task handles**: May have produced code changes, commits, PRs, or surfaced blockers. Blockers worth tracking belong in the issue tracker, not as Memento follow-ups.

### Trajectory channel

Emit one **trajectory record** per substantive session — structured, compact
telemetry, separate from the prose session decision file. It is the missing
substrate piece the learning loop reads: Reflexion failure-lessons,
trajectory clustering, and a future SkillOpt proposer all run over these.

- **Destination:** `sources/trajectories/YYYY-MM-DD/<run-id>.md`, where
  `<run-id>` is `date '+%Y-%m-%dT%H%M%S'` (matches the session-file timestamp
  when both are written). The per-day directory keeps the channel browsable.
- **When:** every session that did real work (a main conversation with edits /
  decisions / research, or a closed Legate/background/workflow handle). Skip
  trivial no-op sessions. This is *not* gated by the "empty capture plan" rule —
  a successful session with no other value items still emits a trajectory record.
- **Shape:** frontmatter-heavy (see `assets/templates/file-formats.md` →
  trajectory). Capture `outcome` (success/partial/failed), `skills_used`,
  `tools_used`, `harness`, `artifacts` (PRs/commits/files), and a short
  `lessons` list (the Reflexion hook — what would make the next run go better).
- **Local-only forever.** Trajectories are saturated with real context and are
  **never promoted**; they live only in the local Memento. Retention/GC is a
  later-phase concern — for now, append; do not prune.

Trajectory emission does not require user confirmation (it is telemetry, not a
follow-up). It still routes sensitive entity observations to `private/` per the
sensitivity rules — keep the trajectory record itself free of `private_notes`
entity assessments.

## Step 4: Capture plan (and confirmation gates)

Build a capture plan — for each item:
- Category and destination file
- New file or append to existing
- One-line preview of what will be written
- For any proposed follow-up: a one-line "why this passes the bar"
  (the re-read-and-act-within-a-week justification)

**Nothing to capture:** if the plan is empty, print "Nothing to capture" (with a one-line reason) and stop. Don't create empty files, don't commit. This short-circuit applies to both modes.

### Follow-up cap and confirmation

Hard cap: **at most one new follow-up per `/save` invocation.** If the
session surfaced multiple candidates, rank them by the bar, propose only
the strongest, and surface the rest as one-liners ("Other candidates
considered and rejected as follow-ups: …") so the user can override if
they disagree.

In both default and ask modes, any new follow-up requires explicit
confirmation via `AskUserQuestion` before it is written. Phrase the
prompt around the bar:

> "Capture as follow-up? `<title>` — `<one-line why-this-passes-the-bar>`.
> The bar is: you'd re-read this within a week and act on it. If not,
> say no and it stays out of the queue."

If the user declines, drop the follow-up from the plan and proceed with
the rest. Updates to existing follow-ups (`## Notes` appends) do not
require confirmation — they are continuations, not new captures.

### Mode behavior

**Default mode (no arg, `approve`):** print the plan as a record of what's about to happen. Run the per-follow-up confirmation gate above for any proposed new follow-up. Then proceed to Step 5 for everything else.

**Ask mode (`ask`):** print the plan and wait for explicit user approval of the whole plan before proceeding to Step 5. The follow-up gate still runs inside ask mode — it is a stricter check on top of the broader plan approval. For `save all ask`, batch plans across all targets into a single prompt and get one approval; per-follow-up confirmations remain individual.

`save all` in default mode proceeds without whole-plan approval — Rich triggered it deliberately — but follow-up confirmations still fire per handle.

## Step 5: Write files

Read `assets/templates/file-formats.md` for the exact frontmatter and body
shape of each destination (follow-up, decision, research, note, analysis,
private note).

For updates to existing follow-ups, append a dated entry under a `## Notes`
section rather than rewriting the body. Private notes always append; never
overwrite.

## Step 6: Close down

### For a Legate handle
Close the delegated work after capture:

1. Prefer `legate:stop <handle>` via the Skill tool.
2. For tmux-backed legacy handles, kill the tmux window only after capture:

```bash
tmux kill-window -t "<name>"
```

### For the main conversation
Commit all written files:
```bash
git -C "$MEMENTO_ROOT" add sources/ outputs/ private/
git -C "$MEMENTO_ROOT" commit -m "save: capture session — <brief summary>"
```

`sources/` covers every subdirectory (`sessions/`, `notes/`, `followups/`,
`syncs/`).

### For `save all`
Save each Legate handle (extract + close), then save the main conversation (extract + commit everything together).

## Sensitivity rules

- Observations about people (assessments, coaching notes, performance context) go to
  `private/`, never to `sources/` or `wiki/`. The Entity Types registry controls which
  entity types have this boundary.
- Private 1:1 content stays in `private/`
- Content already persisted elsewhere (PRs, issue trackers) doesn't need duplication
