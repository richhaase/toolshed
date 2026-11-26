# Change mode

Explain one change: a branch, pull request, commit range or release. The viewer should finish
knowing what is different and why, without reading the diff.

## Find the story

**What is being explained.** With no other instruction, explain the change on the current
branch against its base. Otherwise use the pull request, commit range or release the user named.

**Read the change.** Use `git diff base...head`, the commit messages, and the pull request or
issue if there is one. Then answer three questions in a sentence each:

1. *What can someone now see or do that they could not before?* This is what you film.
2. *Why was it changed?* This is the opening line.
3. *What should the viewer do or watch for afterward?* This is the closing card.

Leave out what does not serve those answers. Refactors, renames and dependency bumps get one
spoken clause at most, never a scene.

## Before and after

When the contrast is the point (a fixed bug, a redesigned screen, a faster path, different
command output), show both sides:

- **Web:** run the base ref alongside the head, for example from a `git worktree` on another
  port, and film the same path twice. Give the two browser scenes `badge: 'Before'` and
  `badge: 'After'`. The recipe is in [storyboard.md](storyboard.md#recipes).
- **CLI:** two terminal scenes with `cwd` pointing at the base worktree and the head, running
  the same command. Set each scene's `title` to say which is which, such as `my-tool (before)`.

Skip the before scene when the change is purely additive: "this did not exist" needs no footage.
Remove any worktree you added when you are done.

## Changes with nothing to look at

For a backend, library or pipeline change, film what proves it and what explains it:

- A terminal scene with the command and its new output, the test that now passes, or the
  request and its response.
- A code scene on the few lines that carry the change, when seeing them is quicker than
  describing them. Point at the lines; never scroll through a whole diff.
- A diagram scene when the change moves or adds a part: show the shape, then `focus` on what is
  new.

One or two of these between title cards make a complete walkthrough.

## Shape

Title card (why it changed), one to three scenes showing the change, closing card (what to
remember or do next). Aim for 45 to 120 seconds.
