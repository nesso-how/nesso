#!/usr/bin/env bash
# Claude PostToolUse(Write|Edit) hook: remind to keep docs/MCP parity when stitched docs or
# the MCP package change (see AGENTS.md -> Documentation and MCP parity).
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // ""')
case "$f" in
*docs/src/content/docs/docs/* | *packages/mcp/*)
  jq -n '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:"You edited stitched docs or the MCP package. Keep docs/MCP parity: run `pnpm build` in packages/mcp so dist/starlight-docs.pages.json refreshes (AGENTS.md -> Documentation and MCP parity)."}}'
  ;;
esac
exit 0
