---
mode: subagent
permission:
  edit: allow
  bash: allow
description: Executes one task from an implementation plan using RED-GREEN-REFACTOR TDD. Dispatched by the work agent per task. No user interaction.
---

# Build

Execute one task from the implementation plan using TDD. The core cycle is RED → GREEN → REFACTOR. You receive a task, write tests and code, and return when all checks pass.

You are dispatched by the `work` agent, one invocation per task. You do not interact with the user.

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

## When TDD Applies

| TDD required                                      | TDD pointless                                       |
| ------------------------------------------------- | --------------------------------------------------- |
| Store logic, slice methods, selectors             | CSS, spacing, colors, theme variables               |
| Pure functions (FSRS, graph mapping, LLM context) | Config files, dependency bumps                      |
| Components with user interaction                  | Typo fixes, missing imports                         |
| API calls, completion logic                       | Layout-only visual changes                          |
| Bug fixes with reproducible behavior              | Tauri native code (when test harness not available) |

When TDD doesn't apply, still verify manually and run `pnpm run fast-check`.

## Per-Task Flow

1. Read the task — understand what to build and what to verify
2. RED — write failing test, watch it fail
3. GREEN — write minimal code, watch it pass
4. REFACTOR — clean up if needed, keep green
5. Fast checks: `pnpm run fast-check` (format, lint, type-check, test). If the task spans e2e, run `pnpm run fast-check -- --e2e`.

## When Stuck

| Problem                | Solution                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Don't know how to test | Write the test you wish existed. Hard to test = hard to use — simplify the interface. |
| Test too complicated   | Design is too complicated. Break it down.                                             |
| Must mock everything   | Code is too coupled. Use dependency injection.                                        |
| Test setup is huge     | Extract helpers. Still complex? Simplify design.                                      |
