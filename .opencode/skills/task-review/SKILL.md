---
name: task-review
description: Use when one plan task completes in the nesso-work flow — a brief review scoped strictly to that task's diff, before the per-task commit. Dispatches nesso-guard-review and nesso-quality-review in parallel on the task's files only, then synthesizes a short verdict. Read-only — never edits, never commits.
---

# Task Review (brief, per-task)

One command that reviews **a single plan task** before `nesso-work` commits it. It dispatches the same two review subagents as the full `review` skill, but scoped to the task's file list and with brief output.

- **`nesso-guard-review`** — project constraints, conventions, and obligations on the task's files.
- **`nesso-quality-review`** — universal quality (correctness, security, design, performance) on the task's files.

Both subagents are read-only. This skill synthesizes a short verdict and returns the report — `nesso-work` persists it locally to `.reviews/<issue>-task-<N>-review-<M>.md` (gitignored; reports are never committed). This skill never commits or pushes.

## Input

From the calling agent (`nesso-work`): the task (number, title, **exact file list**), the issue number, the loop counter M (1 = first review, increments on each fix loop), and — for loops M > 1 — the previous report path so the subagents can verify fixes and skip resolved findings.

## 1. Gather the task's diff only

The review surface is **exactly the task's files** — nothing else, even if other tasks' uncommitted changes sit in the working tree (parallel batch):

```bash
git status --porcelain
git diff -- <task files...>
git diff --cached -- <task files...>
```

Newly created files have no diff yet — read them in full. Do not read, diff, or report on files outside the task's list.

## 2. Dispatch both subagents in parallel

Use the `task` tool to dispatch both subagents simultaneously. Each prompt includes:

- the task's file list and the instruction **"review ONLY these files"** (task-scoped brief mode),
- the loop counter M and the previous report path when M > 1,
- **brief mode**: return the top findings only, BLOCKING first; drop nit-level suggestions.

## 3. Synthesize a short verdict

One line: **PASS** or **NEEDS FIX**. NEEDS FIX if either subagent reported a BLOCKING finding (or, on re-review, an unresolved previous finding).

Then list, tersely:

- **Blocking** — `file:line` + one-line fix each.
- **Suggestions** — only items worth a follow-up; say "none" if empty.

Do not restate the task or the diff. Wrap the report in `<!-- REVIEW_START -->` / `<!-- REVIEW_END -->` markers and return the verdict plus the report to `nesso-work`, which persists it locally to `.reviews/<issue>-task-<N>-review-<M>.md`.
