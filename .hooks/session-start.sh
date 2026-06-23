#!/usr/bin/env bash
# Session start: optional pnpm install on fresh clones, fetch origin, rebase nudge if behind.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

read_hook_input
detect_platform "${1:-}"

# Fresh worktree or clone: install dependencies before the session touches the tree.
if [ -f package.json ] && [ ! -d node_modules ] && command -v pnpm >/dev/null 2>&1; then
  pnpm install 1>&2 || true
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  emit_empty
  exit 0
fi

git fetch origin --quiet 2>/dev/null || true
upstream=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)
[ -n "$upstream" ] || upstream="origin/main"
if ! git rev-parse --verify --quiet "$upstream" >/dev/null 2>&1; then
  emit_empty
  exit 0
fi

behind=$(git rev-list --count "HEAD..$upstream" 2>/dev/null || echo 0)
if [ "${behind:-0}" -gt 0 ]; then
  emit_additional_context \
    "This branch is $behind commit(s) behind $upstream. Consider rebasing onto it before opening a PR (see .rules/pull-requests.md)." \
    SessionStart
else
  emit_empty
fi
exit 0
