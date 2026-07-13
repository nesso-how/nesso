---
name: building
description: Use when implementing any feature, bugfix, or refactoring from an approved plan.
---

# Building

Implement code from the plan using TDD. The core cycle is RED → GREEN → REFACTOR.

<EXTREMELY-IMPORTANT>
No production code without a failing test first. If you wrote code before the test, delete it and start from the test.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete
</EXTREMELY-IMPORTANT>

## When TDD Applies

TDD is non-negotiable for logic and behavior. It is not required (and often not useful) for:

| TDD required                                      | TDD pointless                                       |
| ------------------------------------------------- | --------------------------------------------------- |
| Store logic, slice methods, selectors             | CSS, spacing, colors, theme variables               |
| Pure functions (FSRS, graph mapping, LLM context) | Config files, dependency bumps                      |
| Components with user interaction                  | Typo fixes, missing imports                         |
| API calls, completion logic                       | Layout-only visual changes                          |
| Bug fixes with reproducible behavior              | Tauri native code (when test harness not available) |

When TDD doesn't apply, still verify manually and run `pnpm run format:check && pnpm run lint && pnpm run type:check`.

## RED-GREEN-REFACTOR

### RED — Write Failing Test

Write one minimal test showing what should happen. Clear name, one behavior, real code (mocks only when unavoidable).

```bash
pnpm test path/to/test.test.ts
```

The test must fail because the feature is missing — not because of a typo. Test passes? Delete it and write one that tests the new behavior. Test errors? Fix the error and re-run.

### GREEN — Minimal Code

Write the simplest code to pass the test. Nothing more. No extra features, no "improvements", no refactoring unrelated code.

```bash
pnpm test path/to/test.test.ts
```

All tests must pass, including existing ones. No warnings. Fix any failures now.

### REFACTOR — Clean Up

After green only: remove duplication, improve names, extract helpers. Keep tests green. Don't add behavior.

### Bug Fixes

Same cycle. Write a failing test that reproduces the bug first. The test proves the fix and prevents regression.

### Choosing the Test Level

See `.rules/testing.md` for the full decision framework: unit for pure logic/store/FSRS, integration for workspace/IDB, e2e for full user flows.

## Per-Task Flow

1. Read the task — understand what to build and what to verify
2. RED — write failing test, watch it fail
3. GREEN — write minimal code, watch it pass
4. REFACTOR — clean up if needed, keep green
5. Fast checks: `pnpm run format:check && pnpm run lint && pnpm run type:check`, plus the test suite matching the task's level — `pnpm test` for unit/integration, `pnpm test:e2e` for e2e, both when the task spans levels.
6. Move to next task

## After All Tasks

When the plan is fully implemented, run **`preflight`** — **REQUIRED** before pushing. It runs every check in `.github/workflows/ci.yml`: format, lint, coverage ratchet, typecheck, builds, license headers, static-analysis gates, and e2e. Do not push until preflight is green.

## When Stuck

| Problem                | Solution                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Don't know how to test | Write the test you wish existed. Hard to test = hard to use — simplify the interface. |
| Test too complicated   | Design is too complicated. Break it down.                                             |
| Must mock everything   | Code is too coupled. Use dependency injection.                                        |
| Test setup is huge     | Extract helpers. Still complex? Simplify design.                                      |
