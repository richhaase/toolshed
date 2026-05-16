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
- **Default mode writes immediately** — no approval step. `ask` is opt-in.
  This applies to `save all` too: it proceeds without confirmation.
- **Empty capture plan ⇒ stop.** Don't create empty files, don't commit, don't
  emit a "nothing to do" commit. Print the reason and exit.
- **Bright line: tasks vs follow-ups.** Tasks are commitments the user made
  *in this session* ("I'll send the email tomorrow"). Everything else worth
  not losing is a follow-up. When in doubt, file as follow-up — promotion is
  cheap, demotion is expensive because the misclassified task has already
  shaped the next briefing.
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
| **Tasks** | The user explicitly committed to drive an action ("I will do X", "I'm going to ship Y") | `sources/tasks/topic-slug.md` |
| **Follow-ups** | Open questions, awareness items, loose ends, things others surfaced, judgment calls awaiting user clarification | `sources/followups/topic-slug.md` |
| **Research** | New information, findings worth preserving | `sources/sessions/YYYY-MM-DDTHHmmss-topic.md` |
| **Analyses** | Substantive ad-hoc analyses, trade-off evaluations | `outputs/reports/YYYY-MM-DDTHHmmss-topic.md` |
| **Private notes** | Observations about entities with `private_notes: yes` | `private/<filename-pattern>` (append) |
| **Task updates** | Progress on existing tasks — subtasks completed, blockers found | Update existing `sources/tasks/*.md` |
| **Follow-up updates** | New context on existing follow-ups | Update existing `sources/followups/*.md` |

Most sessions produce 0-2 items. Don't force it.

### Tasks vs Follow-ups — the bright line

This split matters. Conflating them produces "urgent task" framings on what
were actually informational items.

- **Task** = a commitment the user made. They said, in this session, that
  they will do X. Existence of the file means an open commitment.
- **Follow-up** = anything else worth not losing. The thing exists, the
  question is open, someone surfaced it, a loose end was left — but the
  user has not committed to drive it. Default destination for captures.

When in doubt, file as a follow-up. Promotion (follow-up → task) is cheap
and happens via the `followups` skill when the user decides to drive it.
Demoting a misclassified task is more painful — it has already shaped the
next briefing.

Heuristics:
- "I'll look at that later" → follow-up (vague intent, no commitment).
- "I'll send the email tomorrow" → task (specific, committed).
- "We should think about X" → follow-up.
- Someone else's request, until the user accepts it → follow-up.
- An open question waiting on the user → follow-up.

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
- **Task handles**: May have produced code changes, commits, PRs, or surfaced new tasks/blockers.

## Step 4: Capture plan (and optional approval)

Build a capture plan — for each item:
- Category and destination file
- New file or append to existing
- One-line preview of what will be written

**Nothing to capture:** if the plan is empty, print "Nothing to capture" (with a one-line reason) and stop. Don't create empty files, don't commit. This short-circuit applies to both modes.

**Default mode (no arg, `approve`):** print the plan as a record of what's about to happen, then proceed directly to Step 5. Do not wait for confirmation.

**Ask mode (`ask`):** print the plan and wait for explicit user approval before proceeding to Step 5. For `save all ask`, batch plans across all targets into a single prompt and get one approval.

`save all` in default mode proceeds without approval — Rich triggered it deliberately.

## Step 5: Write files

Read `assets/templates/file-formats.md` for the exact frontmatter and body
shape of each destination (task, follow-up, decision, research, analysis,
private note). Tasks are templated inline — that file has the canonical
simple/complex shapes.

For updates to existing follow-ups, append a dated entry under a `## Notes`
section rather than rewriting the body. For tasks, edit the file directly.
Private notes always append; never overwrite.

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

`sources/` includes `sources/followups/` automatically.

### For `save all`
Save each Legate handle (extract + close), then save the main conversation (extract + commit everything together).

## Sensitivity rules

- Observations about people (assessments, coaching notes, performance context) go to
  `private/`, never to `sources/` or `wiki/`. The Entity Types registry controls which
  entity types have this boundary.
- Private 1:1 content stays in `private/`
- Content already persisted elsewhere (PRs, issue trackers) doesn't need duplication
