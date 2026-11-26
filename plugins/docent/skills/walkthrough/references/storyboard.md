# Storyboard reference

A storyboard is an ES module whose default export is an object (or an async function returning
one). It needs no imports. Paths in it are relative to the storyboard file.

## Contents

- [Top level](#top-level)
- [Scenes](#scenes): title, browser, terminal, code, diagram
- [Build output](#build-output)
- [Recipes](#recipes)

## Top level

| Key | Default | Meaning |
| --- | --- | --- |
| `scenes` | required | Array of scenes, played in order. |
| `title` | `'Walkthrough'` | Stored in the MP4 metadata. |
| `output` | `'walkthrough.mp4'` | Output path. A `.srt` is written next to it. |
| `baseURL` | none | Lets browser scenes use relative URLs. |
| `viewport` | `{ width: 1280, height: 720 }` | CSS pixels the app lays out in. |
| `size` | `{ width: 1920, height: 1080 }` | Output pixels. Must share the viewport's aspect ratio. |
| `colorScheme` | `'light'` | `'light'` or `'dark'`, passed to the browser. |
| `theme` | indigo on navy | `{ accent, background, foreground, muted }` for cards, diagrams, terminal and code backdrops, cursor ripple and highlights. Match the project's brand color with `accent`. |
| `voice` | `'af_heart'` | Kokoro voice. Others include `af_bella`, `af_nicole`, `am_michael`, `am_fenrir`, `bf_emma`, `bm_george`. |
| `speed` | `1` | Narration speed multiplier. Stay within 0.9 to 1.15. |
| `pronounce` | `{}` | `{ written: 'spoken' }` whole-word replacements applied to the voice only. |
| `engine` | `'kokoro'` | `'kokoro'` or `'say'` (macOS-only draft voice; `sayVoice` picks the voice). |
| `gap` / `lead` / `tail` | `0.35` / `0.4` / `0.45` | Seconds of quiet after each narrated step, and at the start and end of each scene. |
| `setup` / `teardown` | none | Async functions run once before and after recording (seed or reset data here). They run only when at least one scene is recorded. |
| `contextOptions` | `{}` | Extra Playwright `browser.newContext` options (locale, timezone, permissions, `httpCredentials`). |
| `actionTimeout` | `15000` | Default Playwright timeout in ms. |

## Scenes

Every scene accepts `name` (used for its id, `--only`, and the chapter), `chapter` (chapter title
override) and `fade` (fade in and out; defaults to true for title scenes only).

### `type: 'title'`

A full-screen animated card.

```js
{ type: 'title', kicker: 'Release 2.4', title: 'Faster search',
  subtitle: 'What changed and how to use it',
  bullets: ['Up to three short lines'],   // optional; shrinks the title
  say: 'Narration for this card.',        // optional
  duration: 3 }                           // minimum seconds on screen
```

### `type: 'browser'`

A recorded browser session. Each scene gets a fresh page.

```js
{ type: 'browser', name: 'checkout',
  url: '/cart',                            // opened before recording starts
  prepare: async ({ page, ui, context }) => {}, // unrecorded setup: log in, dismiss banners, wait for data
  freshState: false,                       // true = ignore cookies/storage saved by earlier scenes
  badge: 'Before',                         // optional persistent corner label, e.g. 'Before' / 'After'
  contextOptions: {},                      // per-scene Playwright context options
  steps: [ { say, do, hold } ] }
```

Step fields:

- `say`: narration string. Optional.
- `do`: `async ({ page, ui, context }) => {}`. `page` is a normal Playwright `Page`, so anything
  Playwright can do is available. Optional.
- `hold`: minimum seconds the step stays on screen. Use it on steps without narration.

Cookies and local storage carry from one browser scene to the next (saved in
`.docent/state.json`), so a login performed in one scene's `prepare` holds for later scenes.

#### The `ui` helpers

Raw Playwright actions are instant and invisible. `ui` performs them the way a person would, with
a visible pointer. Targets are a selector string or a Playwright `Locator`.

| Helper | What the viewer sees |
| --- | --- |
| `ui.click(target, options?)` | Pointer glides to the element (scrolling it into view if needed), pauses, clicks with a ripple. |
| `ui.type(target, text, { delay = 55, clear = false })` | Clicks the field, types key by key. |
| `ui.press(key)` | Presses a key such as `'Enter'`. |
| `ui.hover(target)` | Pointer glides to the element and rests there. |
| `ui.highlight(target, { ms = 1800, dim = true, wait = true })` | A ring around the element while the rest of the page dims. |
| `ui.callout(text, { ms = 2600, position = 'bottom', wait = false })` | A caption banner over the page. |
| `ui.scroll(pixelsOrTarget, { ms = 700 })` | Smooth scroll by an amount or to an element. |
| `ui.pause(ms)` | Wait. |

Use plain `page` calls for things that should not be shown as pointer movement, such as
`await page.waitForResponse(...)` or `await expect(...)`-style waits (`locator.waitFor()`).

### `type: 'terminal'`

A styled terminal window. Commands are typed out, then really run in a pseudo-terminal, so colors
and progress output appear as they would for a person.

```js
{ type: 'terminal', name: 'tests',
  cwd: '..',                 // relative to the storyboard file; default is its folder
  title: 'my-project',       // window title; defaults to the cwd's folder name
  fontSize: 18,
  env: {},                   // extra environment variables
  steps: [ { say, run, show, clear, allowFail, timeout, typeDelay, hold } ] }
```

Step fields:

- `run`: shell command to execute.
- `show`: text to type on screen instead of `run`, for when the real command needs flags or
  paths that would distract (keep it honest: same command, tidier spelling).
- `clear`: clear the screen before this step.
- `allowFail`: by default a non-zero exit stops the build; set this when the failure is the point.
- `timeout`: ms before the command is killed (default 120000).

Avoid interactive programs and pagers (`git --no-pager log`, `--no-watch`, `CI=1`).

### `type: 'code'`

A source file in an editor window, syntax-highlighted, read from disk when the scene is
recorded. Each step points at lines: they light up, the rest dims, and the view scrolls to them.

```js
{ type: 'code', name: 'retry-policy',
  file: 'src/worker.py',     // relative to cwd; a step may switch to another file
  cwd: '..',                 // relative to the storyboard file; default is its folder
  language: 'python',        // optional; inferred from the file name
  fontSize: 17,              // 17 shows about 22 lines of roughly 100 characters
  steps: [ { say, find, span, lines, note, file, hold } ] }
```

Step fields:

- `find`: text (or a `RegExp`) to look for; the first line containing it is highlighted. `span`
  extends the highlight to that many lines (default 1). Prefer this to `lines`: it keeps
  pointing at the right code when the file is edited above it.
- `lines`: explicit line numbers instead: `12`, `[12, 20]`, or several ranges
  `[[12, 14], [30, 31]]`.
- `note`: a short label shown beside the highlighted lines. A phrase, not a sentence.
- `file`: switch to another file from this step on (the view cross-fades).
- A step with neither `find` nor `lines` clears the highlight and shows the file undimmed.

The build stops if a file is missing, `find` matches nothing, or `lines` run past the end, so a
storyboard cannot quietly point at the wrong code. Editing a shown file re-records its scene.
Lines longer than the window are cut off at its edge: lower `fontSize` or choose other lines.

### `type: 'diagram'`

An animated boxes-and-arrows diagram for explaining structure or flow: an architecture, a
pipeline, a request's path.

```js
{ type: 'diagram', name: 'pipeline',
  title: 'How an event becomes a row',    // optional heading
  direction: 'right',                     // 'right' (default) or 'down'
  nodes: [
    { id: 'app', label: 'Mobile app', kind: 'external' },
    { id: 'ingest', label: 'Ingest API', sub: 'validates and stamps' },
    { id: 'bus', label: 'events', sub: 'topic', kind: 'queue' },
    { id: 'loader', label: 'Loader' },
    { id: 'lake', label: 'Warehouse', kind: 'store' },
  ],
  edges: [ ['app', 'ingest'], ['ingest', 'bus', 'JSON'], ['bus', 'loader'], ['loader', 'lake', 'hourly'] ],
  layout: [['app'], ['ingest'], ['bus'], ['loader'], ['lake']],   // optional
  steps: [ { say, show, focus, flow, hold } ] }
```

- `nodes`: `id` and `label` are required. `sub` is a smaller second line. `kind` changes the
  shape: `'store'` (database, file, table), `'queue'` (topic, queue, stream), `'external'`
  (dashed: a system outside this project), or omitted for a plain box.
- `edges`: `[from, to]` or `[from, to, label]`. Arrows point from `from` to `to`.
- `layout`: the node ids in each column (or row, for `direction: 'down'`), in order along the
  flow. Without it, each node is placed one step past its furthest upstream node, which suits
  most pipelines. Set it when you want a particular arrangement.

Step fields (ids, or arrays of ids):

- `show`: reveal these nodes. An edge appears once both its ends are visible. If no step in the
  scene uses `show`, the whole diagram is visible from the start.
- `focus`: light these nodes and dim the rest, for this step only.
- `flow`: a path of node ids, such as `['app', 'ingest', 'bus']`. A dot travels along the edges
  between them, repeating until the step ends, and the path is lit. Each consecutive pair must
  be joined by an edge. Pass several paths (`[['a', 'b'], ['a', 'c']]`) to show a fan-out.

Keep a diagram to about eight nodes and four to a column; past that, labels get small. Split a
larger system into an overview diagram and one per part.

## Build output

Next to the storyboard, `.docent/` holds cached narration (`audio/`), per-scene recordings
and timelines (`scenes/`), browser state (`state.json`), failure screenshots (`failure-*.png`),
and per-step stills of the final video (`review/`). It is safe to delete.

The MP4 is H.264 with AAC audio normalized to -16 LUFS, an embedded English subtitle track, and
one chapter per scene.

## Recipes

**Log in once, off camera**

```js
{ type: 'browser', name: 'dashboard', url: '/login',
  prepare: async ({ page }) => {
    await page.getByLabel('Email').fill('demo@example.test');
    await page.getByLabel('Password').fill('demo-password'); // seed account from the repo's fixtures
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/dashboard');
  },
  steps: [ /* recording starts on the dashboard */ ] }
```

**Sign in with an emailed code, off camera**: when local sign-in sends a code to a local mail
viewer (Mailpit, Inbucket, MailHog), request the code in `prepare`, poll the viewer's HTTP API
with `fetch` for a message to that address newer than when you asked, and type the code in. Put
this in a small `signIn(page, email)` function at the top of the storyboard and call it from each
scene that needs a different person, with `freshState: true` so the previous person is signed out.

**Say it, then do it**

```js
{ say: 'Watch the total when the coupon is applied.' },
{ do: async ({ page, ui }) => { await ui.click(page.getByRole('button', { name: 'Apply' })); }, hold: 1.5 },
```

**Before and after for a change set**: run the base ref on another port, then film the same
path twice with absolute URLs and a `badge` on each scene so the viewer always knows which
version is on screen.

```js
// git worktree add ../myapp-base origin/main, then start it on port 5174
{ type: 'browser', name: 'before', badge: 'Before', freshState: true, url: 'http://localhost:5174/reports',
  steps: [ { say: 'Until now, exporting meant three screens.', do: async ({ page, ui }) => { /* ... */ } } ] },
{ type: 'browser', name: 'after', badge: 'After', freshState: true, url: 'http://localhost:5173/reports',
  steps: [ { say: 'Now it is one button.', do: async ({ page, ui }) => { /* ... */ } } ] },
```

**Before and after for a command-line change**: the same command in two terminal scenes, one
per checkout.

```js
// git worktree add ../mytool-base origin/main
{ type: 'terminal', name: 'before', cwd: '../../mytool-base', title: 'mytool (before)',
  steps: [ { say: 'Listing a large project used to take several seconds.', run: './bin/mytool list' } ] },
{ type: 'terminal', name: 'after', cwd: '..', title: 'mytool (after)',
  steps: [ { say: 'With the index, it is immediate.', run: './bin/mytool list' } ] },
```

**From the map to the source**: show the diagram, dive into code, then come back so the viewer
keeps their place. Define the diagram once and reuse it.

```js
const map = { type: 'diagram', title: 'Order pipeline', nodes: [/* ... */], edges: [/* ... */] };
// in scenes:
{ ...map, name: 'overview', steps: [ { say: 'Three stages.', flow: ['extract', 'validate', 'load'] } ] },
{ type: 'code', name: 'validate-code', file: '../pipeline/validate.py',
  steps: [ { say: 'Validation returns two lists, so no row is dropped.', find: 'def validate', span: 6 } ] },
{ ...map, name: 'back-to-map', steps: [ { say: 'Rows that pass move on to loading.', focus: ['validate', 'load'] } ] },
```

**Hide distractions**

```js
prepare: async ({ page }) => {
  await page.addStyleTag({ content: '[data-dev-toolbar], .cookie-banner { display: none !important; }' });
}
```
