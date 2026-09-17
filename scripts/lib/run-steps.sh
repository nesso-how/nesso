#!/usr/bin/env bash
# Shared step-runner harness for fast-check.sh and preflight.sh.
#
# Generic step loop only: per-step header labels, per-step timing, summary,
# and failure handling. Step lists, script-specific flags/env, and
# script-specific messaging stay in the calling scripts.
#
# Expected globals set by the caller before invoking:
#   STEPS    array of "label|command" entries
#   OUT_DIR  directory for per-step log files
#
# Usage: run_steps <suite-name>
# Returns: 0 = all passed; 1 = at least one failed.

run_steps() {
  local suite="$1"
  local -a passed=()
  local -a failed=()
  local entry label cmd step_out start_time end_time status duration total f

  for entry in "${STEPS[@]}"; do
    IFS='|' read -r label cmd <<< "$entry"
    step_out="$OUT_DIR/${label}.out"

    printf "  %-24s" "$label"

    start_time=$(date +%s)
    eval "$cmd" > "$step_out" 2>&1
    status=$?
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    if [ "$status" -eq 0 ]; then
      printf "✓  %3ss\n" "$duration"
      passed+=("$label")
    else
      printf "✗  %3ss  (exit %d)\n" "$duration" "$status"
      failed+=("$label")
      echo "--- output: $label ---"
      cat "$step_out"
      echo "--- end: $label ---"
    fi
  done

  echo ""

  total=$((${#passed[@]} + ${#failed[@]}))
  if [ ${#failed[@]} -eq 0 ]; then
    echo "$suite  ✓  ${#passed[@]}/${total} passed"
    return 0
  else
    echo "$suite  ✗  ${#passed[@]}/${total} passed, ${#failed[@]} failed"
    echo ""
    echo "failed:"
    for f in "${failed[@]}"; do
      echo "  - $f"
    done
    return 1
  fi
}
