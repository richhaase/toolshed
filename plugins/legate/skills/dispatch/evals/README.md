# dispatch evals

Seed eval set for description tuning, per
[optimizing-descriptions](https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/optimizing-descriptions.mdx).

## `trigger-queries.json`

Realistic user prompts labeled with whether they should activate the
`dispatch` skill. Includes near-miss negatives that share keywords with
adjacent legate skills (`inspect`, `debrief`, `watch`) — these are the
queries that test whether the description is precise rather than just broad.

## How to run

The optimizing-descriptions guide ships a reference shell loop that piped
queries through `claude -p` and inspected `--output-format json` for `Skill`
tool calls. Adapt that shape — the detection logic is harness-specific. Aim
for 3 runs per query and a 0.5 trigger-rate threshold.

## Output-quality evals

Not yet seeded. `dispatch` is heavily state-dependent (tmux, `gh` auth,
local git remotes), so an output-quality harness needs to mock or sandbox
those before assertions become meaningful. Open scope.
