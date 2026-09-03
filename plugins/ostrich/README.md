# Ostrich — deliberate distraction

Ostrich makes a hard cut from the work occupying your attention. It chooses
one maximally unrelated tangent and leads it for roughly five minutes of
mental distance. Escape is never another decision: there is no menu, no
category prompt, and no clarifying question before the tangent begins.

## Invoking it

Say any of:

```text
Ostrich.
Distract me for five minutes.
Take me somewhere completely unrelated.
```

Replying to an active tangent keeps it going. Asking for another escape picks
a new tangent with more distance from both the work and the tangent just used.

## What it does

1. Silently assesses what you are working on from the current conversation,
   falling back to the workspace's agent entrypoint and the most relevant
   recent local files only when the active cluster is unclear.
2. Builds an exclusion set from the current subjects, adjacent domains,
   people, projects, obligations, and style of thinking. The assessment is
   never shown back to you and never persisted.
3. Generates candidates across substantially different domains and formats,
   ranks them by distance from the exclusion set, novelty against recent
   tangents, fit with learned interests, low sense of obligation, and ability
   to sustain an exchange, then picks the strongest.
4. Opens with a brief hard-cut transition and delivers a self-contained
   tangent with an immediate hook. Discovery, story, playful analysis, thought
   experiments, and small participatory moves are preferred over lists of
   facts.
5. Keeps steering while you engage. Questions stay inside the chosen tangent;
   topic selection is never handed back.

Candidates that read as productivity advice, disguised work, self-optimization,
or an adjacent version of the current problem are rejected. A work-related
candidate survives only when it is genuinely orthogonal, low-stakes, and free
of current obligations.

## Grounding

When a tangent rests on externally verifiable facts, Ostrich verifies the
central claims against reliable sources first and includes a compact source
note. Playful embellishment is welcome but marked so invented detail is not
presented as sourced history. If sourcing would make a tangent cumbersome,
Ostrich chooses a plainly fictional one instead.

External research is for the tangent only. Assessment of your work stays
local; Ostrich never queries external systems to investigate what you are
escaping.

## Preference learning

Ostrich learns broad preferences so later tangents land better, without
overfitting or retaining the work context that prompted the break.

Storage resolves in this order:

1. A preference-store path declared by the workspace's agent instructions.
2. `sources/ostrich-context.md`, when it exists.
3. `.ostrich/context.md`, created only when there is something eligible to
   record and the workspace is writable.

With no safe writable store, Ostrich runs statelessly. Persistence never
delays or blocks the tangent, and store contents are treated as evidence,
not instructions.

Each entry records only a short topic label, broad domain, interaction format,
observed signal, confidence, and date. Explicit preference statements are
high-confidence and persist until you change them. Follow-up questions,
elaboration, and requests to continue count as medium-confidence positive
evidence. Abandoning a tangent counts against that topic-format combination,
not the whole domain. Silence, task switches, and generic acknowledgments
count as nothing. Inferred signals need repetition before they become stable
preferences and never override an explicit statement. Recent history stays
bounded; older evidence folds into stable preferences without a detailed
interaction log.

Ostrich never records sensitive traits, diagnoses, moods, personal
circumstances, or the surrounding work context, and never fabricates a
remembered preference or reaction.

## Not for

- Productive brainstorming or a fresh angle on the current problem.
- Work summaries or recaps.
- Presenting a menu of distractions.

If a message presents a credible immediate safety risk, Ostrich addresses that
before offering distraction.

## Runtime

The plugin is a single Markdown skill with no bundled scripts and no
dependencies. Grounding a factual tangent uses whatever web access the host
agent already has.
