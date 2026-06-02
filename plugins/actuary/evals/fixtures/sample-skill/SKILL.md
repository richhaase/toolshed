---
name: sample-skill
description: This skill processes data files.
---

# Sample Skill

A SYNTHETIC, deliberately-flawed skill used only as an audit target for the
actuary:skill-audit trigger-rate eval. Not a real skill. Its description is
intentionally thin (implementation-led, zero trigger phrases, under-specified)
and it omits a Gotchas section despite the environment-bound trap below — so a
genuine audit has concrete findings to surface.

## Steps

1. Read the input file from the path the user gives.
2. Parse it. The parser silently returns an empty result when the file uses
   CRLF line endings instead of LF — there is no error, the output is just blank.
3. Write the summary to ./out.

## Output

The result should be a JSON object with a `summary` field.
