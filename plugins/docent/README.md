# <img src="assets/icon.png" width="64" height="64" align="middle" alt=""> Docent — narrated walkthrough videos of software

Docent explains software by showing it. It produces a short narrated video from
a storyboard the agent writes, filming the real software and the real source
rather than mocking anything up. It works in three modes:

| Mode | What it explains | What you see |
| --- | --- | --- |
| **Change** | A branch, pull request, commit range or release: what is different and why, with before and after where the contrast matters. | The running app or command, before and after. |
| **Tour** | A whole web app or command-line tool, for someone new to it. | The main paths a person takes, end to end. |
| **Deep dive** | How a backend codebase, library or data pipeline works. | Animated diagrams, the source lines that matter, and a real run. |

## Invoking it

Docent's skill is `walkthrough`. Invoke it by name, or say any of:

```text
Make a walkthrough of this branch.
Explain this pull request in a short narrated video, before and after.
Give me a narrated tour of this app.
Make a video tour of this CLI.
Make a deep-dive video on how this pipeline works.
```

## Installing it

```bash
claude plugin marketplace add richhaase/toolshed
claude plugin install docent@toolshed
```

For Codex:

```bash
codex plugin marketplace add richhaase/toolshed
codex plugin add docent@toolshed
```

Then run the setup script described under [Requirements](#requirements).

## What you get

- A 1080p MP4, usually one to three minutes long.
- Voice narration generated on your machine. No API key and nothing sent to a
  speech service.
- Captions, both embedded and as a separate `.srt` file, and a chapter per scene.

## How it works

The agent reads the change or the codebase, runs the project locally, and writes a storyboard:
a small JavaScript file listing scenes and what to say over each. One command
then builds the video.

1. **Narration first.** Each line is synthesized with the Kokoro voice model,
   and its length sets the pace of that step.
2. **Recording.** Playwright records each scene. There are five kinds:
   - *Browser:* the running app, with a visible pointer, click ripples, typed
     input, highlights, captions, and an optional Before or After badge.
   - *Terminal:* real commands, typed out and actually run, with their real
     output.
   - *Code:* a real source file, syntax-highlighted, with the lines under
     discussion lit and the rest dimmed.
   - *Diagram:* boxes and arrows that appear as they are introduced, with a
     dot travelling along the path being described.
   - *Title card:* animated opening, section and closing slides.
3. **Assembly.** ffmpeg places each narration clip at the start of its step,
   joins the scenes, evens out the loudness, and adds captions and chapters.

Scenes are cached, so fixing one scene re-records only that scene, and a scene
is re-recorded automatically when the code being filmed changes. Each build
also saves still images of every step, highlight and caption, which the agent
checks against the narration before calling the video done. The agent cannot listen to the result, so give
the narration a listen yourself, especially unusual names.

## Requirements

- macOS or Linux
- Node.js 20 or newer, ffmpeg, Python 3, and [uv](https://docs.astral.sh/uv/)
- A way to run the project you want filmed on your machine

Run the setup script once:

```bash
bash plugins/docent/skills/walkthrough/scripts/setup.sh
```

It installs Playwright, a Chromium build and the other Node dependencies into
`~/.cache/docent`; run it again after a plugin update that adds a dependency. The first
narrated build also downloads the voice model there. Together they take about
450 MB. Set `DOCENT_HOME` to keep them somewhere else. Keeping them outside the
plugin folder means a plugin update does not remove them.

## Try the demos

From `plugins/docent`, serve the sample app:

```bash
python3 -m http.server 4173 -d examples/demo/app
```

Then build its walkthrough:

```bash
node skills/walkthrough/scripts/walkthrough.mjs examples/demo/storyboard.mjs
```

The video lands in `examples/demo/out/tiny-tasks.mp4`.

The deep-dive demo explains a tiny data pipeline with a diagram, a code scene
and a real run. It needs no server:

```bash
node skills/walkthrough/scripts/walkthrough.mjs examples/pipeline/storyboard.mjs
```

That video lands in `examples/pipeline/out/tiny-orders.mp4`.

## More

- [The workflow the agent follows](skills/walkthrough/SKILL.md)
- Mode guides: [change](skills/walkthrough/references/change.md),
  [tour](skills/walkthrough/references/tour.md) and
  [deep dive](skills/walkthrough/references/deep-dive.md)
- [Storyboard format and helper reference](skills/walkthrough/references/storyboard.md)
