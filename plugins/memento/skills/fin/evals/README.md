# fin evals

Seed eval set for description tuning, per
[optimizing-descriptions](https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/optimizing-descriptions.mdx).

## `trigger-queries.json`

Realistic user prompts labeled with whether they should activate the `fin`
skill. Negatives target the most-likely false-trigger neighbors:
`tasks` (explicit commitment), `review-followups` (open captures),
and raw tmux operations (no capture intent).

## How to run

The optimizing-descriptions guide ships a reference shell loop that piped
queries through `claude -p` and inspected `--output-format json` for `Skill`
tool calls. Adapt that shape — the detection logic is harness-specific. Aim
for 3 runs per query and a 0.5 trigger-rate threshold.

## Output-quality evals

Not yet seeded. `fin` outputs depend on session content (tmux pane tail or
main conversation history) and the Memento root layout, so an
output-quality harness needs synthetic session fixtures + a writeable
scratch root before assertions become meaningful. Open scope.
