---
name: reviewing
description: Use when the implementation is complete and ready for pre-PR review. Manual-only. Pass --fix to let code-review apply its fixes.
disable-model-invocation: true
---

# Nesso review (pre-PR orchestrator)

One command that runs all three review layers over the current change and folds them into a single verdict. The layers are **complementary and do not overlap** — run them together, never one instead of another:

- **`preflight`** (skill) — the mechanical gate CI enforces (Biome, `tsc`, type-coverage, fallow, builds, license headers).
- **`nesso-reviewer`** (subagent) — the **semantic** constraints no tool sees (single store, no chat history in the store, edge `type: 'nesso'`, no hardcoded colours, AI only via `llm/completion.ts`, no in-place array mutation, no backwards-compat shims, `.rules/` + docs/MCP parity).
- **`code-review`** (skill) — generic correctness bugs + reuse/simplification/efficiency cleanups on the diff.

This skill orchestrates; it never commits or pushes (see AGENTS.md → Git). It is read-only by default; `--fix` only lets `code-review` apply its own fixes to the working tree.

## Arguments

The only flag is **`--fix`** — forwarded to `code-review` so it applies its findings to the working tree. There is no `--comment`: this skill never posts to the PR. Effort is **not** an argument — the skill picks it (see the rubric in step 4). Ignore any other token in `$ARGUMENTS`.

## 1. Scope the change

```bash
git fetch origin
git status --porcelain
git diff --stat
git diff origin/main...HEAD --stat
```

Build the list of changed files (working tree + committed-vs-`main`). Classify the surface — this drives steps 3 and 4:

- **App/semantic surface:** `src/**`, `packages/*/src/**`, the mentor files, `src/types/graph.ts`, `src/data/relationTypes.ts`, or anything under `docs/` / `packages/mcp/**` (docs/MCP parity).
- **Non-code surface only:** `.github/**`, root config (`biome.json`, `*.config.*`), lockfiles, CI/tooling — no app logic.

## 2. Preflight (always)

Invoke the **`preflight`** skill. Capture pass/fail per step. A preflight failure is **blocking** — surface it at the top of the report — but continue to the review layers so the run produces a complete picture in one pass (`code-review` reads the diff and does not need a green build).

## 3. nesso-reviewer subagent (conditional)

If the change touches the **app/semantic surface**, dispatch the **`nesso-reviewer`** subagent (Agent tool, `subagent_type: nesso-reviewer`) to review the current diff against the repo's hard constraints, conventions, and cross-cutting obligations. It runs in its own context and returns a findings report; relay its findings, do not re-derive them.

If the change is **non-code surface only**, skip it and say so in one line (e.g. "skipped — diff is CI/config only, outside the semantic constraints"). The subagent is read-only, so `--fix` never reaches it.

## 4. code-review at auto-picked effort

Pick the effort from the scoped diff, then invoke the **`code-review`** skill with that effort, appending `--fix` only if the user passed it:

| Diff shape                                                                                                                      | Effort   |
| ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Non-code only, or a few trivial lines of logic                                                                                  | `low`    |
| Single-concern app change, ≲150 changed lines, 1–3 files                                                                        | `medium` |
| Multi-file, or touches load-bearing areas (`src/store/**`, `src/llm/**`, `packages/graph`, `src/types/graph.ts`), or ≳150 lines | `high`   |
| Large cross-cutting / migration-like (many subsystems, ≳400 lines)                                                              | `max`    |

State the chosen effort and the one-line reason. For a `max`-tier diff, also **suggest** `/code-review ultra` (deep cloud multi-agent) — but never run it: it is billed and user-only.

## 5. Synthesize one verdict

Merge the three layers into a single report; deduplicate findings that the subagent and `code-review` both surface. Sections:

- **Verdict** — `Ready to PR` or `Blocked`, one line. Blocked if preflight failed or any hard constraint was violated.
- **Preflight** — pass/fail summary; list failing steps.
- **Blocking** — hard-constraint violations (from `nesso-reviewer`) and any correctness bug `code-review` rates blocking. Each: `file:line` + one-line fix.
- **Bugs / risks** — `code-review` correctness findings.
- **Suggestions** — conventions (`nesso-reviewer`) + reuse/simplification/efficiency (`code-review`), deduped.
- **Missed obligations** — rules sync (`AGENTS.md` → **Keeping rules up to date**) and docs/MCP parity gaps (`nesso-reviewer`).

If a section is empty, say so in one line. Do not restate the diff.

If `--fix` was passed, note which fixes `code-review` applied and recommend a re-run of `preflight` before the PR, since fixes change the working tree.
