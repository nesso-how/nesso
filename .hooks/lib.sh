#!/usr/bin/env bash
# Shared helpers for Nesso agent hooks (Claude Code).

read_hook_input() {
  HOOK_INPUT=$(cat)
}

# Prefer an explicit first argument (sessionStart); otherwise infer from stdin shape.
detect_platform() {
  if [ "${1:-}" = claude ]; then
    HOOK_PLATFORM=$1
    return
  fi
  if printf '%s' "$HOOK_INPUT" | jq -e '.tool_input != null' >/dev/null 2>&1; then
    HOOK_PLATFORM=claude
  else
    HOOK_PLATFORM=claude
  fi
}

shell_command_from_input() {
  printf '%s' "$HOOK_INPUT" | jq -r '.command // .tool_input.command // ""'
}

file_path_from_input() {
  printf '%s' "$HOOK_INPUT" | jq -r '.tool_input.file_path // .tool_response.filePath // .file_path // ""'
}

emit_empty() {
  echo '{}'
}

emit_deny_pnpm() {
  local msg="This repo is pnpm-only. Use pnpm instead (pnpm install, pnpm add <pkg>, pnpm -F <pkg> <script>). npx is fine for one-off tools."
  case "$HOOK_PLATFORM" in
  claude)
    jq -n --arg r "$msg" \
      '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
    ;;
  *)
    jq -n --arg m "$msg" \
      '{permission:"deny",agent_message:$m,user_message:"Blocked npm/yarn — this repo is pnpm-only."}'
    ;;
  esac
}

emit_additional_context() {
  local ctx=$1
  local claude_event=${2:-SessionStart}
  case "$HOOK_PLATFORM" in
  claude)
    jq -n --arg c "$ctx" --arg e "$claude_event" \
      '{hookSpecificOutput:{hookEventName:$e,additionalContext:$c}}'
    ;;
  *)
    jq -n --arg c "$ctx" '{additional_context:$c}'
    ;;
  esac
}
