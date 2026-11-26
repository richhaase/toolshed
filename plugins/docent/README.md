# <img src="assets/icon.png" width="64" height="64" align="middle" alt=""> Docent — narrated walkthroughs of a change

Docent explains a change by showing it. Point it at a branch, pull request or
release and it produces a short narrated video: what is different, why it
matters, and what you would see if you tried it. It films the real software
running locally rather than mocking anything up.

## Invoking it

Docent's skill is `walkthrough`. Invoke it by name, or say any of:

```text
Make a walkthrough of this branch.
Explain this pull request in a short narrated video.
Give me a narrated tour of this repo.
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

- A 1080p MP4, usually one to two minutes long.
- Voice narration generated on your machine. No API key and nothing sent to a
  speech service.
- Captions, both embedded and as a separate `.srt` file, and a chapter per scene.

## How it works

The agent reads the change, runs the project locally, and writes a storyboard:
a small JavaScript file listing scenes and what to say over each. One command
then builds the video.

1. **Narration first.** Each line is synthesized with the Kokoro voice model,
   and its length sets the pace of that step.
2. **Recording.** Playwright records each scene. There are three kinds:
   - *Browser:* the running app, with a visible pointer, click ripples, typed
     input, highlights, captions, and an optional Before or After badge.
   - *Terminal:* real commands, typed out and actually run, with their real
     output.
   - *Title card:* animated opening, section and closing slides.
3. **Assembly.** ffmpeg places each narration clip at the start of its step,
   joins the scenes, evens out the loudness, and adds captions and chapters.

Scenes are cached, so fixing one scene re-records only that scene. Each build
also saves a still image per step, which the agent checks against the narration
before calling the video done. The agent cannot listen to the result, so give
the narration a listen yourself, especially unusual names.

## Requirements

- macOS or Linux
- Node.js 20 or newer, ffmpeg, Python 3, and [uv](https://docs.astral.sh/uv/)
- A way to run the project you want filmed on your machine

Run the setup script once:

```bash
bash plugins/docent/skills/walkthrough/scripts/setup.sh
```

It installs Playwright and a Chromium build into `~/.cache/docent`. The first
narrated build also downloads the voice model there. Together they take about
450 MB. Set `DOCENT_HOME` to keep them somewhere else. Keeping them outside the
plugin folder means a plugin update does not remove them.

## Try the demo

From `plugins/docent`, serve the sample app:

```bash
python3 -m http.server 4173 -d examples/demo/app
```

Then build its walkthrough:

```bash
node skills/walkthrough/scripts/walkthrough.mjs examples/demo/storyboard.mjs
```

The video lands in `examples/demo/out/tiny-tasks.mp4`.

## More

- [The workflow the agent follows](skills/walkthrough/SKILL.md)
- [Storyboard format and helper reference](skills/walkthrough/references/storyboard.md)
