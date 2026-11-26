---
name: walkthrough
description: >
  Use this skill when the user invokes walkthrough or Docent, or asks for a
  narrated video that explains software. Three modes: a change walkthrough
  (a branch, pull request, commit range or release, with before and after), a
  tour of a whole web app or command-line tool, and a deep dive into how a
  backend codebase, library or data pipeline works, using animated diagrams
  and highlighted source code. Also for demo videos and explainer screencasts.
  Runs the real software locally, records browser, terminal, code and diagram
  scenes with Playwright, generates voice narration locally, and assembles a
  captioned MP4 with ffmpeg. Not for written summaries, changelogs,
  architecture documents, slide decks, or silent screen recordings.
compatibility: >
  Needs Node.js 20+, ffmpeg, Python 3 and uv on macOS or Linux, plus a way to
  run the target project locally. First use downloads Chromium and a voice
  model (about 450 MB together).
---

# Walkthrough

A walkthrough is a short narrated video that helps someone understand software by watching it:
a change without reading the diff, an app or command-line tool without installing it, or a
backend or data pipeline without tracing the code.

You produce it by writing a **storyboard** (a small JavaScript module) and running one command
that narrates, records and assembles it. Your job is the part the tooling cannot do: deciding
what is worth showing, getting the software into a state worth filming, and writing narration a
person would want to listen to.

`SCRIPTS` below means the `scripts/` folder next to this file.

## Setup (once per machine)

```bash
bash SCRIPTS/setup.sh
```

It installs the Node dependencies and Playwright's Chromium into `~/.cache/docent`, and checks
for `ffmpeg` and `uv`. If it reports something missing, give the user the exact install command
it printed; do not work around a missing tool. Run it again when a build says a dependency is
not installed, which happens after a plugin update adds one.

## Workflow

### 1. Pick the mode and find the story

Settle these before touching the app. Ask the user only if the request leaves them truly open.

**Mode.** Each mode has its own guide to what to film. Read the one you pick before going on.

| Mode | Use it when the user wants | Mostly made of | Guide |
| --- | --- | --- | --- |
| **Change** | a branch, pull request, commit range or release explained, often before and after | browser and terminal scenes | [references/change.md](references/change.md) |
| **Tour** | a whole web app or command-line tool introduced | browser and terminal scenes | [references/tour.md](references/tour.md) |
| **Deep dive** | to understand how a backend, library or data pipeline works | diagram, code and terminal scenes | [references/deep-dive.md](references/deep-dive.md) |

With no other instruction, use change mode on the current branch against its base. When the
user asks about a whole project, choose by where its substance is: tour if a person uses it
through screens or commands, deep dive if what matters is inside. Modes are starting points, not
walls: a change to a pipeline is a change walkthrough that borrows a diagram and a code scene.

**Who is watching.** One sentence: "After watching, a ___ will know ___." A reviewer wants to
know what to check; a teammate wants to know what changed in their daily use; a new engineer
wants a map of the system; a customer wants to know what they gain. The same material yields
different videos.

**Length.** Each guide gives a target. Past it, cut scope instead of talking faster.

### 2. Get it running and rehearse

- If the app and its backend are already running, use them rather than starting a second copy,
  and keep the video read-only (sign in and browse; no posts, bookings or deletes) unless the
  user says the data is disposable.
- Otherwise start the project's dev server the way the repo documents it, in the background,
  and wait until it answers. Seed whatever data makes the screens look real: empty states make
  poor video.
- Note the commit you are filming (`git rev-parse HEAD`) and whether the tree is clean. If
  someone else may be working in the repo, film a copy that cannot move: a `git worktree` of the
  ref, served on its own port.
- Look at the screens you plan to film before writing anything:
  `node SCRIPTS/rehearse.mjs <url> [<url> ...]` saves a screenshot of each page and prints its
  accessibility outline, which is where locators come from. Prefer `getByRole`, `getByLabel` and
  `getByText` over CSS selectors. For a longer rehearsal, write a throwaway script that loads
  Playwright the way `rehearse.mjs` does.
- If showing the change means changing data on camera, decide now how it gets put back, and
  record the state beforehand so you can compare afterward. Undo it in the scene's `cleanup`
  hook, which runs off camera even when the scene fails.
- For anything that does not live in a browser, check the command's output and runtime by
  running it once. Commands slower than about ten seconds need a faster variant or narration
  long enough to cover them.
- For code and diagram scenes, read the files you will show and confirm each claim you plan to
  narrate against the source. Open the file at the lines you intend to point at.

### 3. Write the storyboard

Create `walkthrough/storyboard.mjs` in the target repo (or wherever the user wants it). If the
repo's working tree is busy (uncommitted changes you did not make, or another session working in
it), keep the storyboard in a folder outside the repo instead and point terminal scenes at the
repo with an absolute `cwd`, and set the storyboard's `repo` option to the repo's path so the
build can tell which code it filmed. Every path the build reads or writes (`output`, the
`.docent/` folder) is relative to the storyboard's folder.

The full format, every option, and the `ui` helper API are in
[references/storyboard.md](references/storyboard.md). Read it before writing your first
storyboard. A minimal shape:

```js
export default {
  title: 'Saved searches',
  output: 'saved-searches.mp4',
  baseURL: 'http://localhost:5173',
  scenes: [
    { type: 'title', kicker: 'What changed', title: 'Saved searches',
      subtitle: 'Keep a filter and come back to it',
      say: 'Rebuilding the same filter every morning was the top complaint. This change adds saved searches.' },
    { type: 'browser', name: 'save-a-search', url: '/issues', steps: [
      { say: 'Start from any filtered list. Here, open bugs assigned to me.',
        do: async ({ page, ui }) => {
          await ui.click(page.getByRole('button', { name: 'Filter' }));
          await ui.click(page.getByRole('option', { name: 'Assigned to me' }));
        } },
      { say: 'The new Save button keeps this filter under a name.',
        do: async ({ page, ui }) => { await ui.highlight(page.getByRole('button', { name: 'Save search' })); } },
    ] },
    { type: 'terminal', name: 'tests', steps: [
      { say: 'The behavior is covered by tests.', run: 'npm test -- saved-search' },
    ] },
    { type: 'title', title: 'Saved searches', bullets: ['Save any filter', 'Find it in the sidebar', 'Shared with your team'],
      say: 'Save any filter, find it in the sidebar, and share it with your team.' },
  ],
};
```

Code and diagram scenes take the same step shape, with `find` or `lines` to point at source and
`show`, `focus` or `flow` to animate a diagram:

```js
{ type: 'diagram', name: 'shape', title: 'How an order is processed',
  nodes: [{ id: 'api', label: 'Orders API' }, { id: 'queue', label: 'Queue', kind: 'queue' },
          { id: 'worker', label: 'Worker' }, { id: 'db', label: 'Ledger', kind: 'store' }],
  edges: [['api', 'queue'], ['queue', 'worker'], ['worker', 'db', 'writes']],
  steps: [
    { say: 'The API only accepts the order and queues it.', show: ['api', 'queue'] },
    { say: 'A worker does the slow part and writes the ledger.', show: ['worker', 'db'], flow: ['api', 'queue', 'worker', 'db'] },
  ] },
{ type: 'code', name: 'retry', file: '../src/worker.py', steps: [
  { say: 'A failed write is retried with a growing delay, three times at most.', find: 'def write_with_retry', span: 8 },
] },
```

How timing works, because it shapes how you write steps: each step starts its narration and its
action **at the same moment**, then waits for whichever finishes last. So:

- Pair each sentence with the action it describes. One idea per step.
- To say something *before* acting, use a step with only `say`, then a step with only `do`.
- An action much longer than its narration leaves dead air; the build warns about gaps over
  four seconds.

### 4. Write narration for the ear

- Say what it means, not what is visible. "Click the Save button" wastes the viewer's time;
  "Saving keeps this filter for next time" earns it.
- Open with why: why the change was made, or why the project or component exists. Close with
  what the viewer should remember or do next.
- Short declarative sentences, present tense, one to two sentences per step. Spoken pace is
  about 150 words a minute, so 20 words is roughly eight seconds.
- Use the words the viewer uses. Name a feature the way the interface does, not the way the
  code does. In a deep dive the viewer is an engineer, so use the code's names.
- Write out anything the voice might mangle, or add it to the storyboard's `pronounce` map
  (for example `{ kubectl: 'kube control', 'v2.1': 'version two point one' }`). Captions keep
  your original spelling.
- No filler ("as you can see", "simply", "now let's go ahead and").

### 5. Build

```bash
node SCRIPTS/walkthrough.mjs walkthrough/storyboard.mjs --dry
```

`--dry` synthesizes the narration and prints the timed script without recording. Use it to check
length and pacing first. Then build for real:

```bash
node SCRIPTS/walkthrough.mjs walkthrough/storyboard.mjs
```

The first narration run downloads the Kokoro voice model (about 350 MB) to
`~/.cache/docent/models`. On macOS, `--engine say` uses the instant system voice for quick
picture-only iterations; do the final build without it.

Scenes are cached. A scene is re-recorded when its storyboard entry changes or when the filmed
repo's commit or uncommitted changes differ from when it was recorded; the build prints the
source it is filming. `--only <scene>` re-records just the named scenes and reuses the rest
regardless, warning if any reused footage came from different code. `--force` re-records
everything.

Heed every `warning:` line in the build output: stale footage, a repo that changed mid-build,
dead air, unused `pronounce` entries. Do the final build with `--force` when scenes depend on
state left by earlier scenes, and do not use `--only` on a scene whose effects a later scene is
supposed to undo.

If a scene fails, the error names the scene and step and saves a screenshot of the page at the
moment of failure. Look at the screenshot before changing the storyboard.

### 6. Review before you call it done

The build writes stills to `.docent/review/` next to the storyboard: one just before each step
ends, plus one shortly after each highlight or callout appears. Start with the contact sheets
(`sheet-1.jpg`, ...), which show them in order, then **open any still that needs a closer look**.
Check each against its narration:

- Does the frame show what the sentence is talking about?
- Is the interesting thing on screen, large enough to read, and not cut off or covered?
- Any error banners, loading spinners, empty states, or leftover data from an earlier run?
- Does anything private appear (real names, emails, tokens, internal URLs)? Use seeded data.
  Code scenes show real source: check the visible lines, not only the highlighted ones, for
  secrets and internal hostnames.
- In a code scene, are the highlighted lines the ones the sentence is about?
- In a diagram, does every label fit its box, and do the arrows read in the direction of flow?

- Is every highlight and callout actually visible, and clear of buttons and bars?

For anything else that happens mid-step, pull a frame yourself:
`ffmpeg -ss <seconds> -i <video> -frames:v 1 frame.jpg`.

Fix what you find and rebuild the affected scenes. Then tell the user where the MP4 and the
`.srt` captions are, how long the video runs, and anything you could not verify. You cannot
listen to the audio, so say so, and suggest they check the pronunciation of unusual names.

## What makes it polished

- **Title cards at both ends**, and one between major sections for longer videos. The closing
  card recaps in two or three bullets.
- **Direct attention.** `ui.highlight()` on the thing the sentence is about; `ui.callout()` for a
  label the viewer should read. In code scenes, highlight a few lines per step rather
  than a whole function; in diagrams, `focus` on the part being discussed.
- **Readable size.** The default 1280x720 viewport rendered at 1080p suits most desktop apps.
  Screenshot a few screens during rehearsal: if the UI is dense, or is a mobile-first layout that
  sits in a narrow column with empty margins, use a smaller viewport such as 960x540 so it fills
  the frame. Never use a larger one.
- **Clean state.** Reset data in `setup` or a scene's `prepare` so rebuilding gives the same
  video. Hide dev-only overlays and cookie banners in `prepare`.
- **Real commands, real output** in terminal scenes. Never fake output with `echo`. Trimming
  noisy output with a filter such as `grep` is fine when the narration does not claim more than
  what is shown.
- **Real source** in code scenes. They read the file from disk; never show a tidied copy.

## Boundaries

- Add `.docent/` to the target repo's `.gitignore`; do not commit build intermediates. Ask
  before committing the storyboard or the video.
- Record only local or explicitly user-approved environments. Do not sign in to third-party
  services or enter real credentials to make a video; use the project's seed or test accounts.
- Leave things as you found them: stop any dev server you started, remove any worktree you
  added, and confirm that data you changed on camera is back to its earlier state. Tell the user
  what you changed and restored.
- The `.docent/state.json` file holds the filmed browser's cookies and storage, which can include
  a signed-in session. Do not share or commit it.
