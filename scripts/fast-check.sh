#!/usr/bin/env bash
# Fast check — lightweight per-task verification.
# Runs the checks the build agent runs after each task:
#   format:check → lint → type:check → test
#
# Add --e2e to also run Playwright e2e (for tasks that span levels).
#
# Usage:  bash scripts/fast-check.sh [--e2e]
# Exit:   0 = all passed; 1 = at least one failed.

set -u

E2E=0
for arg in "$@"; do
  case "$arg" in
    --e2e) E2E=1 ;;
    --) ;;
    -h|--help)
      echo "Usage: bash scripts/fast-check.sh [--e2e]"
      echo ""
      echo "  (default)  format:check → lint → type:check → test"
      echo "  --e2e      also run Playwright e2e"
      exit 0
      ;;
    *) echo "Unknown flag: $arg"; exit 2 ;;
  esac
done

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

OUT_DIR="$(mktemp -d)"
trap 'rm -rf "$OUT_DIR"' EXIT

STEPS=(
  "format:check|CI=true pnpm run format:check"
  "lint|CI=true pnpm run lint"
  "type:check|CI=true pnpm run type:check"
  "test|CI=true pnpm run test"
)

if [ "$E2E" -eq 1 ]; then
  STEPS+=("test:e2e|CI=true pnpm run test:e2e")
fi

PASSED=()
FAILED=()

for entry in "${STEPS[@]}"; do
  IFS='|' read -r label cmd <<< "$entry"
  step_out="$OUT_DIR/${label}.out"

  printf "  %-24s" "$label"

  start_time=$(date +%s)
  if eval "$cmd" > "$step_out" 2>&1; then
    end_time=$(date +%s)
    printf "✓  %3ss\n" "$(( end_time - start_time ))"
    PASSED+=("$label")
  else
    end_time=$(date +%s)
    printf "✗  %3ss  (exit %d)\n" "$(( end_time - start_time ))" "$?"
    FAILED+=("$label")
    echo "--- output: $label ---"
    cat "$step_out"
    echo "--- end: $label ---"
  fi
done

echo ""

total=$(( ${#PASSED[@]} + ${#FAILED[@]} ))
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "fast-check  ✓  ${#PASSED[@]}/${total} passed"
  exit 0
else
  echo "fast-check  ✗  ${#PASSED[@]}/${total} passed, ${#FAILED[@]} failed"
  echo ""
  echo "failed:"
  for f in "${FAILED[@]}"; do
    echo "  - $f"
  done
  exit 1
fi
