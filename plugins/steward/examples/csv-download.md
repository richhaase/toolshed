# Example: a CSV download

This is an illustrative conversation, not a required artifact or a record of
an executed check.

## The request

“Let me download the employee list as CSV with the filters I have selected.”

## Align during the work

The agent initially proposes scheduled exports and a reusable format registry.
Nothing in the request or codebase calls for either.

An appropriate check-in:

> I added scheduling and multiple formats to my plan, but your request is for
> the current filtered list as CSV. I'll keep the work focused on that download.

Later, inspection reveals that exports may be too large to finish in a normal
request. That discovery creates a meaningful product choice:

> The largest lists may take several minutes to export. A background download
> would let people leave the page, but adds a pending-download flow. I recommend
> that if exporting those lists is part of this task. Do you need those large
> exports now, or is the current task limited to smaller lists?

The user's answer guides the next move. Ordinary details such as choosing an
existing CSV library remain engineering choices.

## Simplify after construction

Suppose the completed download repeats filter parsing already shared by the
list endpoints and adds a helper that only forwards arguments to the CSV
library. The user asks: “Use Steward Simplify on this change.”

Inspection shows that the established parser preserves the same filter and
error behavior, and that the new forwarding helper serves no other purpose.
The agent reuses the parser and calls the CSV library directly, then checks
filtered output, quoted values, errors, and access rules. A useful report:

> I reused the list endpoints' filter parser and removed the pass-through CSV
> helper. That leaves one place to maintain filter handling and fewer calls to
> trace. Focused checks preserved the filtered rows, CSV quoting, error responses,
> and access rules; the export still uses the same streaming path.

This is an optional local pass. If the existing code were already clear and
consistent with the repository, leaving it alone would be a valid outcome.
A request only for suggestions would produce advice without editing.

## Check the result

Suppose inspection and focused checks establish that the download contains the
filtered rows, handles commas and quotes, and respects existing access rules.
The implementation also includes a scheduler and format registry, with no
current caller or user need for either.

A useful review would explain both findings:

> The download meets the current goal: the checked CSV contains the filtered
> rows, preserves quoted values, and respects access rules. The scheduler and
> format registry add configuration and maintenance for capabilities this task
> does not need. Remove those additions while preserving the download path.

If the user had requested large asynchronous exports and evidence showed that
background processing was needed, that machinery could be justified. Check
looks for that reason; it does not treat additional code as inherently wrong.

If Simplify has changed the implementation before a final Check, Check examines
that resulting state and uses evidence that applies to it. The skills do not
require each other or a fixed sequence.
