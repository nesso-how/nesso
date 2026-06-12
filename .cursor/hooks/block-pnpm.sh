#!/usr/bin/env bash
# Cursor beforeShellExecution hook — this repo is pnpm-only. Deny only when the command's FIRST
# token is exactly `npm` or `yarn`; defer to Cursor's normal handling for everything else
# (so `pnpm`, `npx`, and other commands are never force-allowed or blocked here).
cmd=$(jq -r '.command // ""')
first=$(printf '%s' "$cmd" | awk '{print $1; exit}')
case "$first" in
npm | yarn)
  jq -n '{permission:"deny",agent_message:"This repo is pnpm-only. Use pnpm instead (pnpm install, pnpm add <pkg>, pnpm -F <pkg> <script>). npx is fine for one-off tools.",user_message:"Blocked npm/yarn — this repo is pnpm-only."}'
  ;;
*)
  echo '{}'
  ;;
esac
exit 0
