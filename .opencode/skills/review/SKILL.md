---
name: review
description: Use when the implementation is complete and ready for pre-PR review. Dispatches nesso-guard-review and nesso-quality-review subagents in parallel, then synthesizes one verdict. Read-only — reports findings, never edits.
---

# Nesso Review (pre-PR orchestrator)

One command that dispatches two review subagents in parallel and folds their findings into a single verdict. The subagents cover complementary domains:

- **`nesso-guard-review`** (subagent) — project-specific constraints and conventions: single store, edge types, colour variables, AI endpoint, `.rules/` parity, docs/MCP parity. Your "house rules" guardian.
- **`nesso-quality-review`** (subagent) — universal code quality: logic bugs, race conditions, memory leaks, error handling, XSS/injection, over-engineering, duplication, performance.

Both subagents are read-only. This skill synthesizes, deduplicates, and resolves conflicts (nesso-guard-review wins on project-specific conflicts by definition).

Any agent can load this skill to run a pre-PR review. `nesso-work` loads it at the review phase; you can also invoke it directly on a ready branch.

This skill orchestrates; it never commits or pushes (see AGENTS.md → Git).

If the calling agent provides a path to a previous review report (e.g. `.reviews/<issue>-review-1.md`), read it and pass each finding to the sub-agents so they can verify fixes were applied and avoid re-reporting resolved issues.

## 1. Gather the diff

```bash
git fetch origin
git status --porcelain
git diff --stat
git diff origin/main...HEAD --stat
```

## 2. Dispatch both subagents in parallel

Use the `task` tool to dispatch both subagents simultaneously:

- `subagent_type: "nesso-guard-review"` — reads AGENTS.md Constraints, `.rules/` conventions, cross-cutting obligations
- `subagent_type: "nesso-quality-review"` — reviews the diff for correctness, security, design, performance

Both receive the same diff scope. If previous findings were provided, include them in each subagent's prompt so they verify fixes and skip resolved issues. Each returns a findings report.

## 3. Synthesize one verdict

Merge the two reports into a single consolidated output:

### Verdict — one line

`Ready to PR` or `Blocked`. Blocked if either subagent reported a BLOCKING finding.

### Blocking

Hard-constraint violations (from `nesso-guard-review`) and correctness/security findings rated BLOCKING (from `nesso-quality-review`). Each: `file:line` + one-line fix.

### Bugs & Risks

`nesso-quality-review` correctness findings that were rated SUGGESTION. Memory leaks, race conditions, type unsafety.

### Design

Over-engineering, duplication, misused patterns (from `nesso-quality-review`).

### Performance

Unnecessary re-renders, large imports, inefficient algorithms (from `nesso-quality-review`).

### Conventions

Project-specific convention deviations (from `nesso-guard-review`): non-functional components, wrong imports, unnecessary comments, selector naming.

### Missed Obligations

Rules sync gaps and docs/MCP parity gaps (from `nesso-guard-review`).

If a section is empty, say so in one line. Do not restate the diff.

Wrap the entire consolidated report in `<!-- REVIEW_START -->` / `<!-- REVIEW_END -->` markers so the calling agent can extract and persist it.
