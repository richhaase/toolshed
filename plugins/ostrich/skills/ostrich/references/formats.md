# Formats and delivery

## Contents

- Capability ladder
- Format by distance from cognitive mode
- Recipes
- Artifact constraints
- Terminal toys
- Opening shapes
- Pacing
- Endings and leave-behinds
- Voice

## Capability ladder

Ostrich works at whatever tier the harness offers. Detect the tier from your
own tool list, never from the harness name.

| Tier | Available when | What it adds |
| --- | --- | --- |
| 0 markdown | always | tables, plain-text maps and diagrams, code blocks, links |
| 1 media links | the user can open a URL | images, recordings, and pages opened in a browser |
| 2 artifacts | a tool can publish or render an HTML page | playable toys, generative visuals, mermaid diagrams |
| 3 terminal toys | the user has a shell | a short animation they paste and run themselves |

Every format has a tier-0 version. Downgrade the rolled format to its tier-0
version rather than switching formats.

## Format by distance from cognitive mode

The roll supplies the candidates; this table picks among survivors and
decides how participatory and how visual to play the chosen format.

| User was | Prefer | Avoid |
| --- | --- | --- |
| reading dense text | playable artifact, generative visual, listening party, terminal toy, guess the object | newspaper morning, gallery visit |
| writing prose | live postcard, guess the object, terminal toy, reverse trivia, what is here | constrained verse, collaborative fiction, backwards story |
| writing code | backwards story, gallery visit, taste test by description, creature dossier, listening party | speculative engineering, terminal toy, playable artifact |
| debugging | listening party, what is here, object biography, gallery visit | micro-mystery, lost game rules, word ladder |
| messaging or negotiating with people | field guide entry, expedition packing, creature dossier, generative visual | role-play decision, collaborative fiction |
| planning | mid-scene story formats, listening party, gallery visit, micro-mystery | expedition packing, speculative engineering |
| waiting on something | micro-mystery, playable artifact, word ladder, lost game rules | live postcard |

## Recipes

Each recipe gives the tier-0 version and the upgrade.

- **object biography.** One real object in about 120 words: where it was
  made, the route it took, where it sits now, and the one strange thing about
  it. Link the item page. Upgrade: embed a CC0 image from a museum seed.
- **live postcard.** Date, place, current weather, and one fact about the
  nearest named thing, written like the back of a card. Grounded by open-meteo
  plus geosearch or the ISS. Upgrade: link the map position.
- **micro-mystery.** Setup in eighty words, three clues, the user guesses,
  two more turns. Must be fairly solvable from the clues given.
- **reverse trivia.** Open with a one-word ask, then build everything from
  the answer. Ground with on-this-day or a targeted Wikipedia search.
- **field guide entry.** Placard format: name, range, habitat, behavior,
  field marks, one warning. Plainly fictional and internally rigorous.
- **newspaper morning.** A LoC newspaper seed. Read three small items as the
  person who opened that paper that morning. Link the page image.
- **listening party.** An Internet Archive record. Link it, give two
  sentences of context, and one thing to listen for at a timestamp.
- **gallery visit.** A museum seed. Embed or link the image, direct the eye
  to one corner, ask one question with no wrong answer.
- **thought experiment.** A clean setup, one turn of the screw, a twist at
  the end. Tier 0 only.
- **constrained verse.** One stanza under a stated rule, then the user adds
  one. The rule fits in a single line.
- **role-play decision.** The user holds a specific historical job and makes
  three decisions. Consequences are grounded when they rest on facts.
- **word ladder.** From one word to a distant one in about six rungs, with an
  etymology or sense shift at each rung.
- **speculative engineering.** An absurd goal, real constraints, and a
  plain-text diagram. The rigor is the joke.
- **playable artifact.** Tier 0: a text game in a code block, such as a grid
  maze the user navigates by reply or a guessing game with a twist. Tier 2:
  an HTML artifact under the constraints below.
- **generative visual.** Tier 0: an ASCII map or pattern in a code block.
  Tier 2: an SVG or canvas artifact.
- **terminal toy.** Always paste-to-run. See the tested toys below.
- **guess the object.** Three progressive reveals from a museum or iNaturalist
  seed. The image or link arrives after the guess.
- **backwards story.** Final line first, then five steps back to the cause.
- **creature dossier.** One iNaturalist seed. Link the observation. One
  strange, grounded fact is the spine.
- **expedition packing.** An impossible trip. Alternate items with the user
  and justify each in one line.
- **taste test by description.** Three real things the user has probably never
  tried, compared as if tasting them side by side. Grounded descriptions.
- **what is here.** The rolled coordinates. Geosearch plus weather. Ocean is
  a valid answer with its own subjects: depth, currents, cables, the nearest
  ship lane.
- **lost game rules.** Reconstruct a real forgotten game from sources, or
  invent one and say so. Play a round in text.
- **collaborative fiction.** Alternate lines under one rule for at most six
  exchanges, then end on a line the user can keep.

## Artifact constraints

- One self-contained HTML file with inline CSS and JS. No external assets,
  fonts, or libraries.
- Playable within ten seconds of opening, on a phone and on a laptop.
- One mechanic. Under about 150 lines. Instructions fit in one line.
- Respects the viewer's light or dark color scheme.
- The title is the tangent's hook, not the plugin's name.

Mechanics that fit the budget: a kaleidoscope that follows the pointer, a
one-button reaction timer, a procedural island with a generated gazetteer, a
four-by-four drum grid on Web Audio, a sliding-tile puzzle over a CC0 image,
and connect-the-dots constellations.

## Terminal toys

Show the command in a code block and let the user run it. Each toy below was
tested in bash 3.2 and zsh on macOS and finishes on its own.

Sierpinski triangle:

```bash
for ((y=15;y>=0;y--)); do printf "%*s" $y ""; for ((x=0;x+y<16;x++)); do (( x & y )) && printf "  " || printf "* "; done; echo; done
```

Mandelbrot set:

```bash
awk 'BEGIN{for(y=-1.2;y<=1.2;y+=0.1){s="";for(x=-2.1;x<=0.7;x+=0.04){zr=zi=0;for(i=0;i<40&&zr*zr+zi*zi<4;i++){t=zr*zr-zi*zi+x;zi=2*zr*zi+y;zr=t}s=s (i<40?" ":"#")}print s}}'
```

Rain:

```bash
for i in $(seq 1 60); do awk -v c=$(tput cols) 'BEGIN{srand();for(i=0;i<c;i++)printf (rand()<.08?"|":" ");print ""}'; sleep 0.05; done
```

Breathing bar:

```bash
for i in $(seq 1 80); do n=$(( (i % 20 < 10 ? i % 20 : 20 - i % 20) * 3 + 1 )); printf '\r%*s' $n '' | tr ' ' '#'; sleep 0.06; done; echo
```

## Opening shapes

- **mid-scene.** "The keeper had been counting the wrong ships for a week
  before anyone noticed."
- **one-word ask.** Two lines of hook, then: "Give me a number between one
  and ninety."
- **artifact first.** The link or image, then a single sentence beneath it.
- **postcard.** A date line, a place line, one fact, a sign-off.
- **placard.** Title, maker, date, medium, then a step closer.
- **wrong footing.** A confident claim that the second paragraph overturns.
- **dialogue.** Two voices, no narrator, the subject emerging by line three.
- **instruction.** "Put your hand flat on the desk. Now lift only the ring
  finger." Then the reason.

Vary the shape across a session even when the roll repeats one.

## Pacing

- Opening message aims at 180 words and never passes 250, or 400 for a
  story format. Count before sending.
- Follow-up turns under 150 words unless the user asks for more.
- Substance arrives across turns. Leave the user something to lean into.
- One participatory move per turn at most.

## Endings and leave-behinds

- End the opening on a hook or an open loop.
- Never end on a survey, a rating request, a summary, or "let me know".
- A leave-behind is one line the user can carry into the day: a word, an
  image, a question with no correct answer, a thing to try with their hands.

## Voice

- Dry, warm, and specific. Concrete nouns over adjectives.
- No exclamation stacks, no "fun fact", no "let's dive in", no emoji.
- Confident about sourced facts, plainly playful about invented ones.
- An ostrich aside at most once per session and rarely across sessions.
