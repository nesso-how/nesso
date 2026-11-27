# Development workflow

Nesso is developed with OpenCode. Each step is a command in [`.opencode/commands/`](../.opencode/commands/), and the rules live in [`AGENTS.md`](../AGENTS.md).

1. `/issue` drafts an issue and, once its open decisions are resolved and recorded, implements it. During implementation, the agent stops only for choices that are costly to reverse.
2. `/review <model>` runs the [`review`](../.opencode/agents/review.md) subagent, ideally with a model other than the implementer's. The session verifies the findings and lists them for your approval, and any fix that changes behavior beyond its finding goes back to the same reviewer.
3. `/app` opens the app for the final human review of intent, UX, architecture, tests, and docs. Add `desktop` to open the desktop app instead.
4. `/pr` commits, pushes, and opens the PR. Add `auto` to enable auto-merge.
5. `/release` publishes. See the [release guide](releases.md).

Run `/retro [N]` periodically, not per issue, to check whether the workflow adds entropy. It runs `pnpm entropy` over the last N sessions and the commits they produced, investigates the metrics that moved against the previous window, and proposes changes to rules, scripts, or checks for you to approve one by one.
