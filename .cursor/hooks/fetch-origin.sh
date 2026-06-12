#!/usr/bin/env bash
# Cursor sessionStart hook — fetch origin and, if this branch is behind the remote default
# branch, inject a rebase nudge into the conversation (see .rules/pull-requests.md).
# Cursor hooks communicate over stdio, so this always emits JSON ({} when there is nothing to say).
cat >/dev/null
if ! git rev-parse --git-dir >/dev/null 2>&1; then echo '{}'; exit 0; fi
git fetch origin --quiet 2>/dev/null || true
upstream=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)
[ -n "$upstream" ] || upstream="origin/main"
if ! git rev-parse --verify --quiet "$upstream" >/dev/null 2>&1; then echo '{}'; exit 0; fi
behind=$(git rev-list --count "HEAD..$upstream" 2>/dev/null || echo 0)
if [ "${behind:-0}" -gt 0 ]; then
  jq -n --arg b "$behind" --arg u "$upstream" \
    '{additional_context:("This branch is " + $b + " commit(s) behind " + $u + ". Consider rebasing onto it before opening a PR (see .rules/pull-requests.md).")}'
else
  echo '{}'
fi
exit 0
