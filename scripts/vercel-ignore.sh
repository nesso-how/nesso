#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" decision for this monorepo.
#
# Vercel's convention: exit 0 => skip the build, exit >=1 => build.
# Usage: vercel-ignore.sh <docs|app>
#
# The diff is anchored at $VERCEL_GIT_PREVIOUS_SHA — the SHA of the last *successful*
# deploy for this project+branch, which Vercel only exposes inside the Ignored Build
# Step. Anchoring there (instead of HEAD^) covers multi-commit pushes and any builds
# that were previously skipped, so no relevant change can slip through unbuilt.
#
# It fails OPEN (builds) whenever the previous SHA is unknown or unreachable, so the
# worst case is a redundant build, never a stale deploy.
set -euo pipefail

mode="${1:-}"

# Run from the repo root regardless of the project's Root Directory (docs/ for the
# docs site, repo root for the app), so the pathspecs below are always relative to it.
cd "$(dirname "$0")/.."

case "$mode" in
docs)
  # Allow-list: the docs site plus the workspace packages it imports. @nesso-how/graph
  # and @nesso-how/types pull relation-types + formats transitively, so all four count;
  # lockfile/workspace changes can alter the install too.
  paths=(docs packages/graph packages/types packages/relation-types packages/formats pnpm-lock.yaml pnpm-workspace.yaml)
  ;;
app)
  # Exclude-list: the Vite bundle is affected by almost the whole repo, so build unless
  # the diff is confined to areas the web build never reads — the docs project, the Rust
  # desktop layer, the MCP package (`pnpm build` doesn't touch it), and repo
  # meta/governance files (CI config, editor/AI rules, git hooks, top-level markdown,
  # license). The `:(glob)` magic keeps `*` from crossing `/`, so `*.md` matches only
  # root-level markdown, never docs/source markdown.
  paths=(
    .
    ':(exclude)docs'
    ':(exclude)src-tauri'
    ':(exclude)packages/mcp'
    ':(exclude).github'
    ':(exclude).cursor'
    ':(exclude).husky'
    ':(exclude,glob)*.md'
    ':(exclude)LICENSE'
  )
  ;;
*)
  echo "vercel-ignore: unknown mode '${mode}' (expected 'docs' or 'app') — building." >&2
  exit 1
  ;;
esac

prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$prev" ]; then
  echo "vercel-ignore[$mode]: no previous successful deploy SHA — building." >&2
  exit 1
fi

# Vercel uses shallow clones, which may not contain the previous commit; fetch just it.
if ! git cat-file -e "${prev}^{commit}" 2>/dev/null; then
  git fetch --no-tags --depth=1 origin "$prev" 2>/dev/null || true
fi
if ! git cat-file -e "${prev}^{commit}" 2>/dev/null; then
  echo "vercel-ignore[$mode]: previous SHA ${prev} unreachable — building." >&2
  exit 1
fi

if git diff --quiet "$prev" HEAD -- "${paths[@]}"; then
  echo "vercel-ignore[$mode]: no relevant changes since ${prev} — skipping build." >&2
  exit 0
fi

echo "vercel-ignore[$mode]: relevant changes since ${prev} — building." >&2
exit 1
