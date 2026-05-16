# Legate backends

Legate is a delegated-work interface. A backend is only the mechanism used to
run, observe, and optionally control that work.

## Capability matrix

| Backend | Dispatch | Debrief | Send follow-up | Logs | Attach | Stop | Discovery | Write isolation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `codex-native` | Yes | Yes | Yes while handle is active | Final/status only | No | Yes | Parent conversation handle | Forked agent workspace |
| `claude-bg` | Yes | Yes | Backend-dependent; attach if no reply CLI exists | Yes | Yes | Yes | Claude agent state | Claude worktree isolation |
| `claude-subagent` | Yes | Final summary | No | Final summary | No | No | Parent conversation | Configurable |
| `tmux` | Yes | Yes | Yes | Yes | Yes | Yes | Tmux tags | No |

Attach is not part of the portable Legate contract. It is a backend-specific
escape hatch for `claude-bg` and `tmux`.

## Backend selection

Explicit user choice always wins:

- `--codex-native`, "use Codex native agents" -> `codex-native`
- `--claude-bg`, "background Claude agent" -> `claude-bg`
- `--claude-subagent`, "Claude subagent" -> `claude-subagent`
- `--tmux`, "terminal session", "attachable window" -> `tmux`

When the user does not choose:

1. In Codex, prefer `codex-native` for bounded sidecar work:
   read-only investigation, verification, code review, isolated implementation,
   or parallel work with a clear ownership boundary.
2. In Claude Code, prefer `claude-bg` for durable delegated sessions when
   background agents are available.
3. Use Claude subagents for narrow in-session tasks that should return a summary
   rather than become durable delegated work.
4. Use `tmux` when the user asks for a visible terminal session, cross-runtime
   launch, manual attachability, or when native primitives are unavailable.

## Handle format

When dispatch succeeds, record a handle in the conversation so later Legate
skills can resolve natural references:

```text
<!-- legate:handles -->
- <name>|backend=<backend>|id=<backend-id>|cwd=<path>|source=<source>|desc=<description>
```

`name` is the human-facing handle. `id` is backend-specific:

- `codex-native`: the agent id returned by the native agent tool.
- `claude-bg`: the short id printed by `claude --bg`.
- `claude-subagent`: a short local label if no durable id exists.
- `tmux`: the tmux window name.

Use conversation history first, then backend-native discovery. Do not create a
registry file unless a future backend cannot be resolved any other way.

## Backend operations

### `codex-native`

Use Codex native agent tools when available.

- Exploratory task: spawn an `explorer`.
- Implementation task: spawn a `worker`, give it explicit ownership, and tell it
  other agents may be editing elsewhere in the codebase.
- Follow-up: send input to the existing agent handle if it is still open.
- Debrief: wait for completion if needed, then summarize the final message.
- Logs: expose only the latest known status or final response.
- Attach: unsupported.
- Stop: close/cancel the agent handle when the host provides that operation.

### `claude-bg`

Use Claude Code background agents when available.

```bash
claude --bg --name "<name>" "<prompt>"
claude logs <id>
claude attach <id>
claude stop <id>
```

Claude stores background state under the Claude config directory, normally
`~/.claude/jobs/<id>/state.json`, and maintains a roster under
`~/.claude/daemon/roster.json`. Prefer the CLI commands above; read state files
only for status snapshots when a command is unavailable or too heavy.

### `claude-subagent`

Use the Claude Code Agent/Task tool or a named subagent when the work is scoped
and should return to the parent conversation. It is not durable delegated work:
there is no attach, no later follow-up, and no independent stop operation.

### `tmux`

Use the existing tmux contract: a window per delegated session, Legate user
options for metadata, `/tmp/legate-<name>.md` for the task brief, pane capture
for logs, and pane-tail hashes for watch deltas.
