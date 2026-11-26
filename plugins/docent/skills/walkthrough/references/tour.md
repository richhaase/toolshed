# Tour mode

Introduce a whole web app or command-line tool to someone who has never used it. The viewer
should finish knowing what it is for and how its main paths feel, not every feature it has.

## Find the story

Ask: what are the two to four things that make this project what it is? Read the README, the
routes or subcommands, and the entry points, then pick the paths a new user takes first. It is a
tour, not an inventory: leave settings pages, flags and edge cases out unless one of them is the
point of the product.

Order the stops the way a person would meet them: arrive, do the main thing, see the result.
Each stop is one scene.

## Web apps

- Start where a new user starts: the landing page or the first screen after sign-in. Sign in off
  camera in `prepare`.
- Film real tasks end to end (create the thing, find it again, share it) so the viewer sees
  cause and effect, not a slideshow of screens.
- Seed data so lists, charts and dashboards look lived in. Empty states make poor video.
- Use a title card between stops when the tour has more than two.

## Command-line tools

- Open with the one command that shows what the tool is for, not `--help`. Show help output
  only if the tool's shape is unclear without it, and trim it with the tool's own options.
- Then run the two or three commands that make up a normal session, in the order a person would
  run them, against a small sample project or data set you prepared.
- Keep each command's output to what fits on screen; prefer the tool's own quiet or filter flags
  over piping through `head`. Use `clear: true` between unrelated commands.
- For a tool with both a CLI and a web view, give each its own scene.

## Shape

Title card (what it is and who it is for), two to four stops, closing card (how to get it or
where to go next). Aim for 60 to 150 seconds.
