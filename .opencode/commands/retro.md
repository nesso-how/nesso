---
description: Measure the last N sessions for workflow entropy and propose fixes; default 20
---

Sessions: $ARGUMENTS

Fetch `origin`, then run `pnpm entropy`, passing `--sessions` if a number is given. Investigate only the metrics that moved against the previous window and the sessions that stand out in the current one: launch one subagent per session to extract the corrections, rework, workarounds, and ignored or conflicting rules behind them from `opencode session export <id>`, filtered in a pipe and never written to a file, then read the commits and PRs involved.

Report the metrics that moved, then numbered proposals, each backed by at least two references to sessions, commits, or PRs. Prefer removing a rule, then a script, check, or config change, then a new rule. Give no scores, edit nothing, and quote sessions only as much as a proposal needs; the user approves proposals one by one.
