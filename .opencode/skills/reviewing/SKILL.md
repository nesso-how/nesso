---
name: reviewing
description: Use when the implementation is complete and ready for pre-PR review. Dispatches guard-reviewer and quality-reviewer subagents in parallel, then synthesizes one verdict. Read-only — reports findings, never edits.
disable-model-invocation: true
---

# Nesso Review (pre-PR orchestrator)

One command that dispatches two review subagents in parallel and folds their findings into a single verdict. The subagents cover complementary domains:

- **`guard-reviewer`** (subagent) — project-specific constraints and conventions: single store, edge types, colour variables, AI endpoint, `.rules/` parity, docs/MCP parity. Your "house rules" guardian.
- **`quality-reviewer`** (subagent) — universal code quality: logic bugs, race conditions, memory leaks, error handling, XSS/injection, over-engineering, duplication, performance.

Both subagents are read-only. This skill synthesizes, deduplicates, and resolves conflicts (guard-reviewer wins on project-specific conflicts by definition).

This skill orchestrates; it never commits or pushes (see AGENTS.md → Git).

## 1. Gather the diff

```bash
git fetch origin
git status --porcelain
git diff --stat
git diff origin/main...HEAD --stat
```

## 2. Dispatch both subagents in parallel

Use the `task` tool to dispatch both subagents simultaneously:

- `subagent_type: "guard-reviewer"` — reads AGENTS.md Constraints, `.rules/` conventions, cross-cutting obligations
- `subagent_type: "quality-reviewer"` — reviews the diff for correctness, security, design, performance

Both receive the same diff scope. Each returns a findings report.

## 3. Synthesize one verdict

Merge the two reports into a single consolidated output:

### Verdict — one line
`Ready to PR` or `Blocked`. Blocked if either subagent reported a BLOCKING finding.

### Blocking
Hard-constraint violations (from `guard-reviewer`) and correctness/security findings rated BLOCKING (from `quality-reviewer`). Each: `file:line` + one-line fix.

### Bugs & Risks
`quality-reviewer` correctness findings that were rated SUGGESTION. Memory leaks, race conditions, type unsafety.

### Design
Over-engineering, duplication, misused patterns (from `quality-reviewer`).

### Performance
Unnecessary re-renders, large imports, inefficient algorithms (from `quality-reviewer`).

### Conventions
Project-specific convention deviations (from `guard-reviewer`): non-functional components, wrong imports, unnecessary comments, selector naming.

### Missed Obligations
Rules sync gaps and docs/MCP parity gaps (from `guard-reviewer`).

If a section is empty, say so in one line. Do not restate the diff.
