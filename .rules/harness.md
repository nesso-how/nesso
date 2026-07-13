# Harness

The **harness** is the scaffolding this repo ships to steer the AI coding agent. It spans the canonical rules, the always-on project brief, the MCP wiring, and the skills and subagents. It is project code like any other, versioned in the repo.

This rule defines the **invariants** that keep the harness coherent: conditions that must stay true no matter how the scaffolding is moved or renamed. If an invariant is violated, the harness is out of sync. A deliberate end-to-end audit against every invariant here is a separate step you invoke (see **Enforcement** below); this file is the definition of "coherent" that such an audit checks.

## Invariants

### Rules ↔ AGENTS.md agreement

The canonical rules under [`.rules/`](.) are the single source of truth. OpenCode reads `AGENTS.md` always-on and opens the relevant `.rules/<name>.md` on demand via the **Touch → update** table.

- **Bijection.** Every `.rules/<name>.md` file is listed in AGENTS.md's **Area rules** bullet list, and every entry in that list corresponds to an existing `.rules/<name>.md` file. No orphaned rule files; no stale list entries.
- **Touch → update coverage.** The **Touch → update** list in AGENTS.md covers the same set as Area rules. For each rule, the glob paths in Touch → update match the files that actually exist in the repo. Prose-only extras (e.g. `testing.md` listing `vitest.config.ts`, `playwright.config.ts`, `e2e/**`, and "CI test steps") are allowed and not machine triggers.
- **Source references.** Links from `AGENTS.md` into `.rules/` resolve to real files.

### Skills and subagents

Skills live at `.opencode/skills/<name>/SKILL.md`; subagents at `.opencode/agents/<name>.md`. Each carries valid frontmatter. A skill and a subagent may cover related ground (e.g. the `reviewing` skill dispatches the `guard-reviewer` and `quality-reviewer` subagents); that is composition, not duplication. Primary agents (e.g. `brainstorm`, `fix`, `work`) are also defined in `.opencode/agents/`.

When creating or editing a skill, always load **`writing-skills`** first. When creating or editing a subagent, always load **`writing-agents`** first (when available in context). These skills enforce the structure and quality rules that keep the harness coherent.

### MCP is declared in `opencode.json`

OpenCode declares MCP servers under `mcp` in `opencode.json`. A repo-shipped server (e.g. `nesso`) is declared there. No second MCP declaration point exists.

### Prefer scripts over skills for deterministic work

If a recurring task can run as a plain deterministic script (no AI judgment needed), write a script — not a skill. Skills burn tokens and produce ambiguous results on work that a script does exactly once. Skills are for tasks that need judgment: choosing, weighing, routing, reviewing. Scripts are for tasks that are already decided: bumping versions, formatting, running fixed checklists. `scripts/release.mjs` and `scripts/stryker/areas.mjs` are examples of this principle.

### Links and source references (resolution invariant)

- Intra-`.rules` links (`[foo](foo.md)`) and any `[[memory]]` links resolve to files that exist.
- Links from `AGENTS.md` into `.rules/` resolve.
- Source references named in rules (paths like `src/…`, package files, exported symbols) point to things that still exist. This is the part most exposed to drift during a restructuring, and the one only judgment can catch — a moved or renamed symbol still reads as a valid link.

## Scope — only git-tracked scaffolding

A file is a harness surface only if it is **tracked in git**. Whatever is gitignored is out of scope by construction — machine-local worktrees, `*.local` config — so there is no exclusion list to keep current; git already draws the line.

## Self-application

This file is a harness surface and obeys the rules it defines: its paths are the harness surfaces enumerated above, and it appears in AGENTS.md's Area rules and Touch → update lists. A rule that governs the harness being governed by itself is ordinary self-application (a linter that lints its own config), not a paradox.

## Sync-along and enforcement

When you touch any harness surface, keep the others coherent **in the same change** so these invariants stay true — the same "Touch → update" reflex the product rules use, applied to the scaffolding. Be honest about its reliability: loading this rule on a harness edit is a **reminder**, no stronger than any always-on instruction, and reminders let drift through. The durable enforcement is a **deliberate full audit** against these invariants, run at the end of a restructuring or before a PR. That audit reports drift per invariant and severity and proposes fixes; it applies them only on explicit approval.
