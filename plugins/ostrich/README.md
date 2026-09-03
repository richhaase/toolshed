# Ostrich — deliberate distraction

Ostrich makes a hard cut from the work occupying your attention. It rolls a
tangent from outside the model's own habits, seeds it from the real world,
and leads it in a format chosen for distance from what you were just doing.
Escape is never another decision: there is no menu, no category prompt, and
no clarifying question before the tangent begins.

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
| another, again | rolls a new tangent farther from both the work and the last tangent, in a different format |
| weirder | goes more absurd and plainly fictional, with rigorous internal logic |
| realer | goes more grounded, sourced, and contemporary |
| more of this | stays in the domain, changes the hook, and records that you liked it |
| shorter, longer | adjusts length for the rest of the session |
| back, done | steps aside in one line with no summary and no questions |

## What it does

1. Silently assesses what you are working on and which cognitive mode you
   are in: reading, writing prose, writing code, debugging, messaging people,
   planning, or waiting. The assessment is never shown back to you and never
   persisted.
2. Rolls dice. `scripts/roll` draws three candidates from the tangent grid,
   each with a domain, a format, a constraint, a seed source, and an opening
   shape, plus a random date, coordinates, integer, and letter. The roll
   pushes the model off its habits; the rolled domain and format are binding
   unless they collide with your work, an explicit dislike, or the novelty
   check.
3. Fetches a seed when the roll says so: a random Wikipedia article, a
   newspaper page from the rolled date, a public-domain museum object, one
   research-grade species observation, a shellac record, the weather at the
   rolled coordinates, or where the space station is right now. The seed is
   the spine and its page is the source.
4. Picks the format's texture by distance from your cognitive mode. Someone
   escaping prose gets something visual or playable. Someone escaping code
   gets a story.
5. Opens in the rolled shape, under 250 words, and keeps steering while you
   engage. Questions stay inside the tangent; topic selection is never handed
   back.

Hooks that read as productivity advice, disguised work, or a widely
circulated fact are rejected in favor of one level more specific: one
patent, one shipwreck, one person nobody has heard of.

## Multi-modality

Ostrich delivers at the highest tier the harness offers and downgrades the
same format rather than switching:

| Tier | Needs | Adds |
| --- | --- | --- |
| 0 | nothing | markdown, plain-text maps and diagrams, links |
| 1 | a browser | museum images, archive recordings, newspaper scans |
| 2 | an artifact or page-publishing tool | sixty-second games, generative visuals, mermaid |
| 3 | a shell | short terminal animations you paste and run yourself |

Terminal toys are shown, never run for you. The bundled ones were tested in
bash 3.2 and zsh.

## Preference learning

Ostrich learns broad preferences so later tangents land better, without
overfitting or retaining the work context that prompted the break.

The store resolves in this order: `OSTRICH_STORE`, a path declared by the
workspace's agent instructions, `sources/ostrich-context.md` when it exists,
`.ostrich/context.md` when it already exists, then `~/.ostrich/context.md`,
which is created on first write. New stores go to the home directory so
preferences travel across projects and never land in a repository by
accident. With no writable store, Ostrich runs statelessly.

The store holds stable likes and dislikes with confidence, explicit
exclusions, a bounded ledger of past tangents, and domain coverage counts.
The ledger drives the novelty check and occasional callbacks to tangents you
enjoyed. Three of every four rolls ignore learned likes so the learner cannot
narrow the space; dislikes and exclusions always apply.

Ostrich never records sensitive traits, diagnoses, moods, personal
circumstances, or the surrounding work context, and never fabricates a
remembered preference, reaction, or source.

## Not for

- Productive brainstorming or a fresh angle on the current problem.
- Work summaries or recaps.
- Presenting a menu of distractions.

If a message presents a credible immediate safety risk, Ostrich addresses
that before offering distraction.

## Layout

- `skills/ostrich/SKILL.md` is the procedure.
- `skills/ostrich/scripts/roll` is the dice. Bash 3.2 or later, no
  dependencies, no network. `OSTRICH_SEED` makes a roll reproducible.
- `skills/ostrich/references/tangent-grid.md` is the single source of truth
  for what can be rolled. Edit its lists to change the dice.
- `skills/ostrich/references/formats.md` covers the capability ladder,
  format recipes, artifact constraints, terminal toys, opening shapes,
  pacing, and voice.
- `skills/ostrich/references/seed-sources.md` documents every no-key API
  the seeds use, with fields and licensing.
- `skills/ostrich/references/store-format.md` is the preference store
  template, bounds, and novelty check.
- `evals/evals.json` holds behavioral cases, including a twenty-run
  diversity test.

Seed fetches use the host agent's own web access; the bundled script makes
no network requests.

## Tests

```bash
bash tests/roll.test.sh
ROLL_TEST_SHELL=/bin/bash bash tests/roll.test.sh
```

The second form proves the roll under the system bash on macOS.
