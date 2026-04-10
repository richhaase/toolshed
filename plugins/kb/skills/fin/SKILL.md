---
name: fin
description: Finish a session — extract useful data, persist to sources, close down. Works on legate sessions and the main conversation. Use when wrapping up any session ("we're done", "wrap up", "fin", "close out"), when closing a legate, or as the final step before killing a legate window. Also triggers on "session-log", "log this", "anything to capture?".
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Agent]
---

# Fin

Finish a session. Extract anything worth keeping, persist it, close down.

Works on two kinds of sessions:

1. **Legate sessions** — capture the tmux pane output, extract value, write to sources, kill the window.
2. **Main conversation** — scan the current conversation, extract value, write to sources, commit.

## Arguments

Arguments are passed as: $ARGUMENTS

- No arguments → fin the current (main) conversation
- A legate window name (e.g., `pr-52`, `research-auth`) → fin that legate session
- `all` → fin all open legate sessions, then the main conversation

## Step 0: Determine the target

**No arguments = fin the main conversation. Do NOT check on, debrief, or interact with legates.** Legates are independent sessions — they keep running. Only touch them if explicitly named or `all` is passed.

If a legate name is given, verify the window exists:
```bash
tmux show-option -wv -t "<name>" @legate-managed 2>/dev/null
```

If `all`, list all legate-managed windows:
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

### For a legate session

Capture the full visible output:
```bash
tmux capture-pane -t "<name>" -p -S -500
```

Also read the legate's description and source tags for context:
```bash
tmux show-option -wv -t "<name>" @legate-description
tmux show-option -wv -t "<name>" @legate-source
```

### For the main conversation

Scan the current conversation history. You have full access to it — no tmux capture needed.

## Step 2: Extract value

Review the session content and identify items in these categories:

| Category | What to look for | Destination |
|----------|-----------------|-------------|
| **Decisions** | Choices made, direction set, options ruled out | `sources/YYYY-MM-DD-topic.md` |
| **Tasks** | Action items, follow-ups, things to do later | `sources/tasks/topic-slug.md` |
| **Research** | New information, findings worth preserving | `sources/YYYY-MM-DD-HHmm-topic.md` |
| **Analyses** | Substantive ad-hoc analyses, trade-off evaluations | `outputs/YYYY-MM-DD-HHmm-topic.md` |
| **Task updates** | Progress on existing tasks — subtasks completed, blockers found | Update existing `sources/tasks/*.md` |

Most sessions produce 0-2 items. Don't force it.

### What NOT to capture

- Things already written to files during the session
- Routine operations (git commands, file reads, debugging steps)
- Information already in the repo that hasn't changed

### Legate-specific patterns

Legates often produce specific kinds of value:

- **Research legates**: Findings should already be written to `sources/` by the research skill. Check if the doc exists; if not, capture the findings.
- **Investigation legates**: Findings may warrant a research doc or analysis if substantive.
- **Interactive task legates**: May have produced code changes (already committed) or surfaced new tasks/blockers.

## Step 3: Present the capture plan

Show the user what you plan to persist. For each item:
- Category and destination file
- New file or append to existing
- One-line preview of what will be written

If nothing worth capturing, say so. Don't create empty files.

Wait for the user's approval before writing. Exception: when running `fin all` on many legates, batch the plan for all of them and get one approval.

## Step 4: Write files

### Tasks
Use the tasks skill for creation. For updates to existing tasks, edit the file directly.

### Decisions
```markdown
---
date: YYYY-MM-DD
topic: Short description
---

# Decision: [Topic]

## Context
## Decision
## Alternatives considered
## Implications
```

### Research
Dated filename, YAML frontmatter with topic/tags/sources/staleness.

### Analyses
```markdown
---
date: YYYY-MM-DD
topic: Short description
---

# [Topic]

[Content]
```

## Step 5: Close down

### For a legate session
Kill the tmux window:
```bash
tmux kill-window -t "<name>"
```

### For the main conversation
Commit all written files:
```bash
git add sources/ outputs/
git commit -m "fin: capture session — <brief summary>"
```

### For `fin all`
Fin each legate (extract + kill), then fin the main conversation (extract + commit everything together).

## Sensitivity rules

- No personnel assessments in public files — those belong in `private/`
- Private 1:1 content stays in `private/`
- Content already persisted elsewhere (PRs, issue trackers) doesn't need duplication
