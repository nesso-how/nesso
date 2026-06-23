#!/usr/bin/env bash
# Block npm/yarn when they are the command's first token (pnpm-only repo).
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

read_hook_input
detect_platform "$@"

cmd=$(shell_command_from_input)
first=$(printf '%s' "$cmd" | awk '{print $1; exit}')
case "$first" in
npm | yarn)
  emit_deny_pnpm
  ;;
*)
  emit_empty
  ;;
esac
exit 0
