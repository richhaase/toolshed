# <img src="assets/icon.png" width="64" height="64" align="middle" alt=""> Ostrich — deliberate distraction

Ostrich creates a quick, lighthearted break from the work occupying your
attention. It silently excludes the current work cluster, chooses one coherent
tangent, and gives you a complete five-to-ten-minute diversion without asking
you to pick a category or build a choose-your-own-adventure one reply at a
time.

## Invoking it

Say any of:

```text
Ostrich.
Distract me for five minutes.
Take me somewhere completely unrelated.
```

While a tangent is running, steer with plain words:

| Say | Ostrich does |
| --- | --- |
| another, again | chooses a fresh tangent with a different central hook |
| weirder | goes more absurd and plainly fictional while staying coherent |
| realer | goes more grounded, sourced, and contemporary |
| more of this | stays near what worked, changes the hook, and records positive evidence |
| shorter, longer | adjusts length for the rest of the session |
| back, done | steps aside in one line with no summary and no questions |

## How selection works

Ostrich starts from the original quality-based approach: it generates several
possible tangents and chooses the strongest by distance from the work,
immediate appeal, coherence, learned preferences, freshness, and low effort.

The bundled `scripts/roll` adds a small randomness nudge. It samples five
unrelated domains from `references/tangent-grid.md` so the candidate pool is
not limited to the model's usual subjects. Those prompts have no authority:
Ostrich may use one, adapt one, or ignore all of them. The roll never chooses a
format, source, constraint, opening, or final topic.

That boundary is deliberate. Randomness broadens imagination; judgment decides
what is actually fun.

## The initial response is the break

The first response is a complete small experience. It may be a story, a
discovery, playful analysis, a thought experiment, or a compact visual, but it
must work if you never reply. A single easy invitation can follow the tangent;
participation is never required to make it coherent.

Factual tangents use compact reliable sourcing selected to support the chosen
hook. Fictional tangents are plainly playful. Ostrich never turns a random API
result into a premise merely because it was fetched.

## Preference learning

Ostrich learns broad preferences so later tangents land better without storing
the work context that prompted the break.

The store resolves in this order: `OSTRICH_STORE`, a path declared by the
workspace's agent instructions, `sources/ostrich-context.md` when it exists,
`.ostrich/context.md` when it already exists, then `~/.ostrich/context.md`,
which is created on first eligible write. With no writable store, Ostrich runs
statelessly.

The store holds stable likes and dislikes, explicit exclusions, and a bounded
ledger of prior tangents. Exact repeated hooks are rejected. Recent domains and
formats are soft signals rather than bans, and learned preferences inform every
selection. Ostrich never records sensitive traits, diagnoses, moods, personal
circumstances, or the surrounding work context.

## Not for

- Productive brainstorming or a fresh angle on the current problem.
- Work summaries or recaps.
- Presenting a menu of distractions.
- Extended interviews or branching adventures that require repeated choices.

If a message presents a credible immediate safety risk, Ostrich addresses that
before offering distraction.

## Layout

- `skills/ostrich/SKILL.md` is the procedure.
- `skills/ostrich/scripts/roll` samples unique optional domain prompts. It is
  Bash 3.2 compatible, has no dependencies or network access, and supports
  reproducible `OSTRICH_SEED` runs.
- `skills/ostrich/references/tangent-grid.md` holds the domain prompt pool.
- `skills/ostrich/references/store-format.md` defines preference storage and
  soft novelty signals.
- `evals/evals.json` describes behavioral cases for self-contained delivery,
  coherent randomization, steering, grounding, and private preference storage.

## Tests

```bash
bash tests/roll.test.sh
ROLL_TEST_SHELL=/bin/bash bash tests/roll.test.sh
```

The second form proves the helper under the system Bash on macOS.
