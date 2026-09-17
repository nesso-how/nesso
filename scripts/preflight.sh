#!/usr/bin/env bash
# Preflight — local CI parity.
# Mirrors `.github/workflows/ci.yml` (js + e2e jobs) by default.
# Add --rust to also run the rust job (cargo fmt, clippy, check, test, build-smoke).
# See .opencode/skills/preflight/SKILL.md for full docs.
#
# Usage:  pnpm run preflight [--rust]
# Exit:   0 = all passed; 1 = at least one failed.

set -u

RUST=0
for arg in "$@"; do
  case "$arg" in
    --rust) RUST=1 ;;
    --) ;;               # pnpm passes -- before flags
    -h|--help)
      echo "Usage: pnpm run preflight [--rust]"
      echo ""
      echo "  (default)   JS + e2e checks (mirrors ci.yml js+e2e jobs)"
      echo "  --rust      also run cargo fmt/clippy/check/test (src-tauri/)"
      exit 0
      ;;
    *) echo "Unknown flag: $arg"; exit 2 ;;
  esac
done

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

# shellcheck disable=SC1091
source "$(dirname "$0")/lib/run-steps.sh"

OUT_DIR="$(mktemp -d)"
trap 'rm -rf "$OUT_DIR"' EXIT

# Steps in CI order. Each entry: "label|command"
STEPS=(
  "format:check|CI=true pnpm run format:check"
  "security:headers|CI=true pnpm run security:headers"
  "lint|CI=true pnpm run lint"
  "license-headers:check|CI=true pnpm run license-headers:check"
  "test:coverage|CI=true pnpm run test:coverage"
  "type:coverage|CI=true pnpm run type:coverage"
  "build:mcp|CI=true pnpm run build:mcp"
  "build|CI=true pnpm run build"
  "analyze:dead-code|CI=true pnpm run analyze:dead-code"
  "analyze:dupes|CI=true pnpm run analyze:dupes"
  "analyze:health|CI=true pnpm run analyze:health"
  "test:e2e|CI=true pnpm run test:e2e"
)

if [ "$RUST" -eq 1 ]; then
  STEPS+=(
    "icons:desktop|CI=true pnpm run icons:desktop"
    "cargo:fmt|cargo fmt --all --check --manifest-path src-tauri/Cargo.toml"
    "cargo:clippy|cargo clippy --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings"
    "cargo:check|cargo check --all-targets --manifest-path src-tauri/Cargo.toml"
    "cargo:test|cargo test --manifest-path src-tauri/Cargo.toml"
    "cargo:build-smoke|cargo build --manifest-path src-tauri/Cargo.toml"
  )
fi

run_steps "preflight"
