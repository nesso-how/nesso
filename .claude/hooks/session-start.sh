#!/usr/bin/env bash
# Claude SessionStart hook: refresh origin and, if this branch is behind the remote default
# branch, tell the session so it can rebase before opening a PR (see .rules/pull-requests.md).
cat >/dev/null
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
git fetch origin --quiet 2>/dev/null || true
upstream=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)
[ -n "$upstream" ] || upstream="origin/main"
git rev-parse --verify --quiet "$upstream" >/dev/null 2>&1 || exit 0
behind=$(git rev-list --count "HEAD..$upstream" 2>/dev/null || echo 0)
if [ "${behind:-0}" -gt 0 ]; then
  jq -n --arg b "$behind" --arg u "$upstream" \
    '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:("This branch is " + $b + " commit(s) behind " + $u + ". Consider rebasing onto it before opening a PR (see .rules/pull-requests.md).")}}'
fi
exit 0
