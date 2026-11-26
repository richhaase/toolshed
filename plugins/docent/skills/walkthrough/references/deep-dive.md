# Deep-dive mode

Explain how a backend service, library or data pipeline works. There is little or no interface
to film, so the video teaches a concept with three kinds of footage: a **diagram** for the
shape, **code** for the parts that matter, and a **terminal** run to prove it is real.

## Find the story

Trace one thing through the system: a request, a job, a record. Read the entry points,
configuration and tests until you can answer:

1. *What goes in and what comes out?* This is the opening line.
2. *What are the three to six stages or components it passes through?* These are the diagram's
   nodes. More than about eight nodes is two diagrams or too much detail.
3. *Where are the one to three decisions that make this system what it is?* A retry policy, a
   partitioning rule, a validation fork, an idempotency key. These are the code scenes.
4. *What can you run that shows it happening?* A test, a small job on sample data, a query
   against the result. This is the terminal scene.

Leave out everything a newcomer does not need on day one: logging, argument parsing, most error
handling. Say that it exists in a clause if it matters.

## Diagram first, then code

Open with the diagram so every later scene has a place on the map. Reveal it in the order the
data travels, with `show`, and use `flow` to send a dot along the path while the narration
describes it. Label nodes with the names the code uses, so the viewer can find them later.

For each decision, go from the map to the source: a code scene on the real file, with each step
pointing at a few lines. Good practice:

- Prefer `find` over line numbers so the scene survives edits to the file.
- Highlight 3 to 12 lines per step. If a function is longer, show its signature, then the
  lines that matter.
- Narrate what the lines are for and why they are written that way, not what they literally
  say. The viewer can read.
- Use `note` for the one phrase worth remembering, at most once or twice a scene.
- Return to the diagram with `focus` between code scenes when the video covers more than two
  components, so the viewer knows where they are.

## Prove it

End on something running. For a pipeline, run it on a small sample and show the output rows.
For a service, start it and send one request. For a library, run the test that exercises the
path you explained. Prepare small, synthetic sample data: real records do not belong in a video.

When the system is too heavy to run locally (a warehouse job, a cluster), say so in the
narration and show the nearest honest thing: a unit test of the stage, a dry-run plan, or a
query against local fixtures. Never fake output.

## Data pipelines

- Diagram stores (`kind: 'store'`) and queues (`kind: 'queue'`) differently from the stages that
  transform data, and mark systems you do not own as `kind: 'external'`.
- Put what flows on the edges: "raw events", "daily partitions", "rejected rows".
- Show a before and after of the data itself: a few input rows, then the output rows, in
  terminal scenes.
- Cover what happens to bad or late data. It is usually the most useful minute of the video.

## Shape

Title card (what goes in, what comes out), diagram, one to three code scenes, a terminal run,
closing card (the ideas to keep and where the code lives). Aim for 90 to 180 seconds; past
four minutes, split it into a video per component.

A worked example is in the plugin's `examples/pipeline` folder.
