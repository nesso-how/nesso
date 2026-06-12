#!/usr/bin/env bash
# Claude PreToolUse(Bash) hook: this repo is pnpm-only. Deny only when the command's FIRST
# token is exactly `npm` or `yarn`, so `pnpm`, `npx`, and strings that merely mention npm
# (e.g. inside an echo) are never blocked.
cmd=$(jq -r '.tool_input.command // ""')
first=$(printf '%s' "$cmd" | awk '{print $1; exit}')
case "$first" in
npm | yarn)
  jq -n '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:"This repo is pnpm-only. Use pnpm instead (pnpm install, pnpm add <pkg>, pnpm -F <pkg> <script>). npx is fine for one-off tools."}}'
  ;;
esac
exit 0
