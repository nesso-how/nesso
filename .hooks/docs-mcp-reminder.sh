#!/usr/bin/env bash
# Remind to keep docs/MCP parity after edits under docs/ or packages/mcp/.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

read_hook_input
detect_platform "$@"

f=$(file_path_from_input)
case "$f" in
*docs/src/content/docs/docs/* | *packages/mcp/*)
  emit_additional_context \
    "You edited stitched docs or the MCP package. Keep docs/MCP parity: run \`pnpm build\` in packages/mcp so dist/starlight-docs.pages.json refreshes (AGENTS.md -> Documentation and MCP parity)." \
    PostToolUse
  ;;
*)
  emit_empty
  ;;
esac
exit 0
