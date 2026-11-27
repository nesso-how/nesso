# Development workflow

Nesso is developed with OpenCode. Each step is a command in [`.opencode/commands/`](../.opencode/commands/); rules live in [`AGENTS.md`](../AGENTS.md).

1. `/issue` drafts an issue, or implements one after its open decisions are resolved and recorded. During implementation, the agent stops only for choices that are costly to reverse.
2. `/review <model>` runs the [`review`](../.opencode/agents/review.md) subagent, ideally on a model other than the implementer's. The session verifies its findings and lists them for approval; fixes that change behavior beyond a finding go back to the same reviewer.
3. `/app` opens the app, or the desktop app with `desktop`, for the final human review of intent, UX, architecture, tests, and docs.
4. `/pr` commits, pushes, and opens the PR; `auto` enables auto-merge.
5. `/release` publishes; see the [release guide](releases.md).

Periodically, not per issue, `/retro [N]` checks whether the workflow adds entropy. It runs `pnpm entropy` over the last N sessions and the commits they produced, investigates the metrics that moved against the previous window, and proposes changes to rules, scripts, or checks for approval one by one.
