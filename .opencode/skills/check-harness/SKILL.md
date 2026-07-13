---
name: check-harness
description: Use after restructuring the harness or before a PR that touches it. Deliberate coherence sweep against `.rules/harness.md` — verifies the invariants hold (rules ↔ AGENTS.md agreement, link resolution, skill validity). Manual-only; read-only by default, `--fix` applies mechanical fixes to the working tree.
disable-model-invocation: true
---

# Harness check (coherence sweep)

`.rules/harness.md` is the **single source of truth** for what a coherent harness is — its surfaces and every invariant. This skill does not restate any of that; it is the **method** for verifying it, plus the operational know-how the rule deliberately leaves out. Read the rule, check reality against it, report.

Read-only by default; never commits or pushes (see AGENTS.md → Git). `--fix` applies only mechanical, reversible fixes to the working tree; semantic findings are always report-only.

## Arguments

- **`--fix`** — apply the mechanical fixes (realign a glob set, fix a broken relative link, add a missing registry line) to the working tree. Semantic findings (a stale rule paragraph, a link to a renamed symbol) are reported, never auto-applied. Ignore any other token in `$ARGUMENTS`.

## Method

1. **Read [`.rules/harness.md`](../../.rules/harness.md) in full.** It is the checklist. If reality and the rule disagree, the rule wins; if the rule and this skill disagree, that is itself a finding (update one of them).
2. **Enumerate the git-tracked surfaces** — the Scope invariant means tracked files only; anything gitignored (worktrees, `*.local`) is out by construction:
   ```bash
   git ls-files .rules .opencode opencode.json AGENTS.md
   ```
3. **Walk each invariant** and verify it against that evidence — rules ↔ AGENTS.md agreement, Touch → update coverage, skill/subagent validity, link resolution. Read the actual files; do not assume.

## Judgment traps — why this is a sweep, not a script

Several invariants read as mechanical but need judgment. A naive string-diff false-positives on every one of these, which is why the check is an agent, not a regex:

- **Glob-set agreement compares _sets_, not strings.** A glob like `src/**/*.{ts,tsx}` contains a literal comma — do not split it into two.
- **AGENTS.md Touch → update may carry prose-only extras** beyond the file-matching globs (e.g. `testing.md`'s `vitest.config.ts`, `playwright.config.ts`, `e2e/**`). Those are allowed, not drift.
- **A markdown link inside a code span is an example, not a live link** — e.g. `harness.md` writes `[foo](foo.md)` to illustrate the invariant. Don't flag it.
- **A reference to a renamed or moved symbol still reads as valid text.** Only judgment catches it: a path like `src/llm/foo.ts` or an exported-symbol name in a rule looks fine even after the code moved. This is the part most exposed to drift during a restructuring — spot-check references in rules whose subject code changed recently, and report suspects even when unsure.

## Report

Group findings by invariant, most severe first.

- **Verdict** — `Coherent` or `Drift found`, one line.
- **Per invariant** — one block each; for every finding give `file:line` + a one-line fix, tagged **Mechanical** (auto-fixable) or **Semantic** (judgment, report-only). Say "clean" in one line for an invariant with no findings; do not pad or restate the invariant.

If `--fix` was passed, apply the **Mechanical** findings, list exactly what changed, and recommend a re-run without `--fix` to confirm the sweep comes back clean. Never touch Semantic findings — leave those for the user.
