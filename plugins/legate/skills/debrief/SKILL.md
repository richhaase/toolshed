---
name: debrief
description: >
  Check on delegated Legate work and pull status or results back into the
  current conversation. Works across Codex native agents, Claude background
  agents/subagents, and tmux sessions. Use when the user asks to "check on",
  "how's it going with", "status of", "debrief", "any updates from", "is that
  done yet", "what's happening with", "report back on", or otherwise wants to
  know the state of delegated work. Can target one handle or sweep all known
  handles.
argument-hint: "[handle|all]"
allowed-tools: Bash Agent
---

# Debrief

Bring delegated-work state back into the current conversation. Do not assume a
terminal session exists: each backend has its own observation surface.

Read `../_shared/references/backends.md` for backend capabilities and
`../_shared/references/conventions.md` for handle resolution.

## Targeting

Resolve the user's target in this order:

1. Recent conversation context and the `<!-- legate:handles -->` block.
2. Backend discovery, when available:
   - Codex native agent handles in the parent conversation.
   - Claude background agent ids or state under the Claude config directory.
   - Tmux windows tagged with `@legate-managed`.
3. Ask the user only if the target remains ambiguous.

For "all", sweep every known handle plus any discoverable tmux or Claude
background sessions that look Legate-managed.

## Backend reads

### Codex native

Use the native agent handle. If the agent is still running, report that it is
working and include any latest known status. If it completed, summarize its
final response and changed files. If the handle is gone, say so plainly.

### Claude background agent

Prefer the Claude CLI:

```bash
claude logs <id>
```

If a lightweight status snapshot is enough, read the job state when present:

```bash
jq . ~/.claude/jobs/<id>/state.json
```

Respect `CLAUDE_CONFIG_DIR` if it is set. Summarize the task state, whether it
needs input, and any result or PR/check status visible in the logs/state.

### Claude subagent

Report the final returned summary. If no final result is available in the
parent conversation, say that the subagent has no durable status surface.

### Tmux

Read the brief first:

```bash
cat /tmp/legate-<name>.md 2>/dev/null
```

Then capture the pane tail:

```bash
tmux capture-pane -t "<name>" -p -S -50
```

Read from the bottom upward. Skip prompts, tool noise, progress bars, and raw
diffs. Find the last substantive prose block and compare it with the brief.

## Reporting style

Report the task arc, not the raw transcript:

- **Handle** - name and backend.
- **What was asked** - one concise line.
- **Current state** - working, waiting, done, failed, stopped, or unknown.
- **Result** - conclusion or delivered change, when available.
- **Needs intervention** - only when the backend is blocked or likely stuck.

Keep each handle to one or two lines in an all-hands sweep.
