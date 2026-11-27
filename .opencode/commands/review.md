---
description: Run an independent review of the current changes; pass a model to review with it
---

Model: $ARGUMENTS

Launch the `review` subagent on the current changes. If a model is given, resolve it to an exact ID with the `models` tool, ask if the match is ambiguous, and pass it as the subagent model; otherwise omit the model. In the prompt, name the issue or PR, and list as facts the decisions, removed features, exclusions, and checks already run in this session that the issue does not record. Share no reasoning or suspected problems, so the review stays independent. Do not edit files until the review returns.

When it returns, verify each finding against the code, then list the findings by their numbers with a short recommendation for each (fix, skip, or discuss) so the user can approve them one by one. Do not change code until the user decides. If an approved fix changes behavior beyond its finding, say so and offer to send the fixes back to the same reviewer.
