---
name: walkthrough
description: >
  Use this skill when the user invokes walkthrough or Docent, or asks for a
  narrated video that explains a change: a walkthrough of a branch, pull
  request, commit range or release, a demo video of a new feature, or a
  screencast showing what is different and why. Also use it for a narrated
  tour of a whole repository or app. Runs the real software in a local dev
  environment, records browser and terminal scenes with Playwright, generates
  voice narration locally, and assembles a captioned MP4 with ffmpeg. Not for
  written summaries, changelogs, slide decks, or silent screen recordings.
compatibility: >
  Needs Node.js 20+, ffmpeg, Python 3 and uv on macOS or Linux, plus a way to
  run the target project locally. First use downloads Chromium and a voice
  model (about 450 MB together).
---

# Walkthrough

A walkthrough is a short narrated video that helps someone understand a change without reading
the diff: what is different, why it matters, and what they would see if they tried it.

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
it printed; do not work around a missing tool.

## Workflow

### 1. Find the story

Settle these before touching the app. Ask the user only if the request leaves them truly open.

**What is being explained.** With no other instruction, explain the change on the current
branch against its base. Otherwise use the pull request, commit range or release the user named.
A tour of a whole repository is the less common case, covered at the end of this step.

**Read the change.** Use `git diff base...head`, the commit messages, and the pull request or
issue if there is one. Then answer three questions in a sentence each:

1. *What can someone now see or do that they could not before?* This is what you film.
2. *Why was it changed?* This is the opening line.
3. *What should the viewer do or watch for afterward?* This is the closing card.

Leave out what does not serve those answers. Refactors, renames and dependency bumps get one
spoken clause at most, never a scene.

**Who is watching.** One sentence: "After watching, a ___ will know ___." A reviewer wants to
know what to check; a teammate wants to know what changed in their daily use; a customer wants
to know what they gain. The same diff yields different videos.

**Before and after.** When the contrast is the point (a fixed bug, a redesigned screen, a
faster path), show both. Run the base ref alongside the head, for example from a `git worktree`
on another port, and give the two browser scenes `badge: 'Before'` and `badge: 'After'`. Skip
the before scene when the change is purely additive: "this did not exist" needs no footage.

**Changes with nothing to look at.** For a backend, CLI or library change, film what proves it:
the command and its new output, the test that now passes, the request and its response. One or
two terminal scenes between title cards make a complete walkthrough.

**Length.** Aim for 45 to 120 seconds. Past three minutes, cut scope instead of talking faster.

**A whole-repository tour** follows the same steps with a different question: what are the two
to four things that make this project what it is? Read the README, routes and entry points, and
show those. It is a tour, not an inventory.

### 2. Get it running and rehearse

- If the app and its backend are already running, use them rather than starting a second copy,
  and keep the video read-only (sign in and browse; no posts, bookings or deletes) unless the
  user says the data is disposable.
- Otherwise start the project's dev server the way the repo documents it, in the background,
  and wait until it answers. Seed whatever data makes the screens look real: empty states make
  poor video.
- Walk the intended path yourself first, with the browser tools you have or a throwaway
  Playwright script, and note the locators that work. Prefer `getByRole`, `getByLabel` and
  `getByText` over CSS selectors.
- For anything that does not live in a browser, check the command's output and runtime by
  running it once. Commands slower than about ten seconds need a faster variant or narration
  long enough to cover them.

### 3. Write the storyboard

Create `walkthrough/storyboard.mjs` in the target repo (or wherever the user wants it). If the
repo's working tree is busy (uncommitted changes you did not make, or another session working in
it), keep the storyboard in a folder outside the repo instead and point terminal scenes at the
repo with an absolute `cwd`.

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

How timing works, because it shapes how you write steps: each step starts its narration and its
action **at the same moment**, then waits for whichever finishes last. So:

- Pair each sentence with the action it describes. One idea per step.
- To say something *before* acting, use a step with only `say`, then a step with only `do`.
- An action much longer than its narration leaves dead air; the build warns about gaps over
  four seconds.

### 4. Write narration for the ear

- Say what it means, not what is visible. "Click the Save button" wastes the viewer's time;
  "Saving keeps this filter for next time" earns it.
- Open with why the change was made, close with what the viewer should remember or do next.
- Short declarative sentences, present tense, one to two sentences per step. Spoken pace is
  about 150 words a minute, so 20 words is roughly eight seconds.
- Use the words the viewer uses. Name the feature the way the interface does, not the way the
  code does.
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

Scenes are cached. Unchanged scenes are reused; `--only <scene>` re-records just the named
scenes; `--force` re-records everything. Use `--force` for the final build if scenes depend on
state left by earlier scenes.

If a scene fails, the error names the scene and step and saves a screenshot of the page at the
moment of failure. Look at the screenshot before changing the storyboard.

### 6. Review before you call it done

The build writes one still per step to `walkthrough/.docent/review/`. **Open them** and check
each against its narration:

- Does the frame show what the sentence is talking about?
- Is the interesting thing on screen, large enough to read, and not cut off or covered?
- Any error banners, loading spinners, empty states, or leftover data from an earlier run?
- Does anything private appear (real names, emails, tokens, internal URLs)? Use seeded data.

The stills are taken at the end of each step, so highlights and callouts, which fade out, will
usually not appear in them. That is expected.

Fix what you find and rebuild the affected scenes. Then tell the user where the MP4 and the
`.srt` captions are, how long the video runs, and anything you could not verify. You cannot
listen to the audio, so say so, and suggest they check the pronunciation of unusual names.

## What makes it polished

- **Title cards at both ends**, and one between major sections for longer videos. The closing
  card recaps in two or three bullets.
- **Direct attention.** `ui.highlight()` on the thing the sentence is about; `ui.callout()` for a
  label the viewer should read.
- **Readable size.** The default 1280x720 viewport rendered at 1080p suits most desktop apps.
  Screenshot a few screens during rehearsal: if the UI is dense, or is a mobile-first layout that
  sits in a narrow column with empty margins, use a smaller viewport such as 960x540 so it fills
  the frame. Never use a larger one.
- **Clean state.** Reset data in `setup` or a scene's `prepare` so rebuilding gives the same
  video. Hide dev-only overlays and cookie banners in `prepare`.
- **Real commands, real output** in terminal scenes. Never fake output with `echo`.

## Boundaries

- Add `.docent/` to the target repo's `.gitignore`; do not commit build intermediates. Ask
  before committing the storyboard or the video.
- Record only local or explicitly user-approved environments. Do not sign in to third-party
  services or enter real credentials to make a video; use the project's seed or test accounts.
- Stop any dev server you started when you are done, and remove any worktree you added.
