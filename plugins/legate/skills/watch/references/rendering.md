# Watch — output rendering rules

The watch skill renders its tick output as a single contained box so it
stands out from surrounding model output. Every line — header, body, footer,
and any contextual notes — lives inside the box.

## Shape

```
┌─ legate:watch ──────────────────────────────────────────────────────────────
│
│ Appeared:    <window> — <one-line synthesis>
│ Changed:     <window> — <one-line synthesis>
│              <window> — <one-line synthesis>
│ Disappeared: <window>
│
│ Unchanged:   <window>, <window>, <window>
│
└─────────────────────────────────────────────────────────────────────────────
```

## Hard rules

Prior renderings violated these and the box "leaked":

- **Fixed border width.** The top and bottom borders are **78 characters
  wide** (`┌─ legate:watch ` + dashes to fill, and `└` + dashes to fill).
  Always 78 — do not shrink to hug the title and do not stretch to match
  content. A consistent terminal-width container reads as deliberate; an
  arbitrarily narrow box looks like a typo. The bottom border must be the
  same width as the top.
- **Gutter on every line.** Every body line starts with `│ ` (vertical bar
  + space). Plain leading spaces are not a substitute — the bar must be
  there. This includes continuation lines for wrapped synthesis. Blank
  spacer lines are a single `│` with nothing after.
- **Breathing room.** Open with one blank gutter line (`│`) right after
  the header border, close with one blank gutter line right before the
  footer border, and put one blank gutter line between the diff section
  and the optional `Unchanged:` line. Do not pack content edge-to-edge
  against the borders.
- **Wrap inside the box.** If a synthesis runs long, wrap onto a
  continuation line that also starts with `│ `, indented under the value
  column (not under the label). Aim to keep body lines ≤ 76 chars after
  the `│ ` prefix so they fit within the 78-char visual frame.
- **Omit empty sections.** Skip any of `Appeared` / `Changed` /
  `Disappeared` whose diff is empty — don't print an empty header.
- **Everything inside.** Do not print a plain-text recap, an "all quiet"
  follow-up sentence, or any other watch-related text outside the box on
  the same tick. The box is the only rendering.

## Synthesis sourcing

For changed and appeared windows, invoke `legate:debrief <window>` via the
Skill tool to get a one-line synthesis — debrief already knows how to
interpret a pane tail against a brief. For disappeared windows, just note
the name.

The optional `Unchanged:` line is a single comma-separated list of window
names that did not change this tick — included for scan context so the user
can see "everything else is steady". Skip it if there are no unchanged
windows or if it would overflow ~80 chars even after wrapping inside the
gutter.

Keep each window's line to one or two lines. Consistency across ticks
matters more than the specific glyphs.
