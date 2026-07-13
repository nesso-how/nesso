---
name: building
description: Use when implementing any feature, bugfix, or refactoring from an approved plan. Enforces RED-GREEN-REFACTOR TDD with Nesso test patterns. The execution phase of the workflow.
---

# Building

Implement code from the plan using TDD. The core cycle is RED → GREEN → REFACTOR.

<EXTREMELY-IMPORTANT>
When building testable logic: no production code without a failing test first. If you wrote code before the test, delete it and start from the test.
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

When TDD doesn't apply, still verify manually and run `pnpm run lint && pnpm exec tsc -b`.

## RED-GREEN-REFACTOR

### RED — Write Failing Test

Write one minimal test showing what should happen. Clear name, one behavior, real code (mocks only when unavoidable).

```bash
pnpm test -- --filter <package> <test-file>
```

The test must fail because the feature is missing — not because of a typo. Test passes? You're testing existing behavior. Test errors? Fix the error and re-run.

### GREEN — Minimal Code

Write the simplest code to pass the test. Nothing more. No extra features, no "improvements", no refactoring unrelated code.

```bash
pnpm test -- --filter <package> <test-file>
```

All tests must pass, including existing ones. No warnings. Fix any failures now.

### REFACTOR — Clean Up

After green only: remove duplication, improve names, extract helpers. Keep tests green. Don't add behavior.

### Bug Fixes

Same cycle. Write a failing test that reproduces the bug first. The test proves the fix and prevents regression.

## Nesso Commands

**Tests** (see `.rules/testing.md` for strategy):

```bash
pnpm test                    # Vitest unit/component tests
pnpm test:coverage           # With coverage ratchet
pnpm test:e2e                # Playwright e2e (web UI)
```

**Quality** (see `preflight` skill for the full CI checklist):

```bash
pnpm exec tsc -b             # Typecheck
pnpm run lint                # Biome lint
```

Test levels: **unit** (pure logic, store slices, FSRS), **component** (React with interaction), **e2e** (Playwright, full user flows).

## Per-Task Flow

1. Read the task — understand what to build and what to verify
2. RED — write failing test, watch it fail
3. GREEN — write minimal code, watch it pass
4. REFACTOR — clean up if needed, keep green
5. Run `pnpm run lint && pnpm exec tsc -b`
6. Move to next task

## When Stuck

| Problem                | Solution                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Don't know how to test | Write the test you wish existed. Hard to test = hard to use — simplify the interface. |
| Test too complicated   | Design is too complicated. Break it down.                                             |
| Must mock everything   | Code is too coupled. Use dependency injection.                                        |
| Test setup is huge     | Extract helpers. Still complex? Simplify design.                                      |
