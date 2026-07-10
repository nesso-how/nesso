# Harness

The **harness** is the scaffolding this repo ships to steer AI coding agents across three editors — **Claude Code**, **Cursor**, and **OpenCode**. It spans the canonical rules and their per-editor surfacing, the always-on project brief, the hooks, the MCP wiring, and the per-editor skills/commands and subagents. It is project code like any other, versioned in the repo.

This rule defines the **invariants** that keep the harness coherent: conditions that must stay true no matter how the scaffolding is moved or renamed. If an invariant is violated, the harness is out of sync. A deliberate end-to-end audit against every invariant here is a separate step you invoke (see **Enforcement** below); this file is the definition of "coherent" that such an audit checks.

The surfaces are not one kind of thing. They fall into three tiers, and each tier takes a **different** kind of invariant. Asserting cross-editor parity where none exists (MCP, skills) is itself a defect: it makes an audit chase phantom drift.

## Tier 1 — Mirrored across editors (parity invariants)

The canonical rules under [`.rules/`](.) are the single source of truth. Each is surfaced through two **thin wrappers** that carry no content of their own: `.claude/rules/<name>.md` for Claude Code, `.cursor/rules/<name>.mdc` for Cursor. **Edit the canonical `.rules/` file, never a wrapper.**

Only Claude and Cursor use this per-rule wrapper mechanism — a file whose frontmatter globs auto-attach the rule when you edit a matching source file. **OpenCode has no per-rule wrapper**: it reads `AGENTS.md` always-on and opens the relevant `.rules/<name>.md` on demand via the **Touch → update** table, wiring nothing per rule. The bijection and glob invariants below therefore bind the two wrapper editors only; OpenCode adds no third wrapper.

- **Bijection.** For every `.rules/<name>.md` there is exactly one `.claude/rules/<name>.md` and exactly one `.cursor/rules/<name>.mdc`, and vice versa. No canonical file without both wrappers; no wrapper without a canonical file.
- **Claude wrapper form.** Frontmatter with a `paths:` YAML list and nothing else; body is exactly `@../../.rules/<name>.md`. No prose, no duplicated content.
- **Cursor wrapper form.** Frontmatter with `description`, `globs`, and `alwaysApply: false`; body is the one-line `Canonical content lives in [\`.rules/<name>.md\`](../../.rules/<name>.md). Edit that file, not this wrapper.`followed by`@.rules/<name>.md`.
- **Glob-set agreement.** For each rule, the globs in the Claude wrapper `paths:`, the Cursor wrapper `globs:`, and the matching AGENTS.md **Touch → update** entry are the **same set**. Order and formatting are irrelevant (Cursor accepts inline comma-joined or a YAML list; Claude uses a YAML list) — only the set of glob strings must match. AGENTS.md may additionally carry **prose-only** guidance that is deliberately _not_ part of the glob set (e.g. `testing.md` lists `vitest.config.ts`, `playwright.config.ts`, `e2e/**`, and "CI test steps" as prose). Prose extras are not machine triggers and are not required in the wrappers.
- **Hooks parity.** The hooks wired in `.cursor/hooks.json` and `.claude/settings.json` are the **same set** of scripts, and each script they reference exists under `.hooks/`. (`.hooks/lib.sh` is a shared helper sourced by the scripts, not wired directly — that is expected.)

## Tier 2 — Editor-specific (internal-validity invariants, never parity)

These surfaces differ per editor in format and location, and some have no counterpart at all. **Do not** assert cross-editor parity for them; check only that each is internally valid and free of orphans. Making the same command or agent available in more than one editor is a **portability choice** the harness may make, never a bijection the audit enforces.

- **Skills / commands.** Claude skills live at `.claude/skills/<name>/SKILL.md`; OpenCode commands at `.opencode/commands/<name>.md` (or inline under `command` in `opencode.json`). Cursor has no repo-level equivalent. Each Claude skill has valid frontmatter (`name` matching its directory, `description`); those meant to run by command only carry `disable-model-invocation: true` (this is why `nesso-review` and `release` do not appear among auto-loadable skills — intended, not drift).
- **Subagents.** Claude subagents live at `.claude/agents/<name>.md`; OpenCode agents at `.opencode/agents/<name>.md` (or inline under `agent` in `opencode.json`). Each has valid frontmatter (`name`/`description`/`tools`). A skill and a subagent may cover related ground (e.g. the `nesso-review` skill dispatches the `nesso-reviewer` subagent); that is composition, not duplication.
- **MCP is editor-specific and asymmetric.** Cursor declares repo-local servers in `.cursor/mcp.json` (today `nesso`, `tauri`); OpenCode declares them under `mcp` in `opencode.json`; Claude's servers are configured at the **user / plugin** level, outside the repo. There is no single mirrored MCP list. A repo-shipped server (e.g. `nesso`) _may_ be declared in each editor's repo-local config, but that is a config choice, not an enforced bijection — never treat a server present for one editor as missing from another.

## Tier 3 — Always-on (reachability invariant)

`AGENTS.md` is the always-loaded project brief; all three editors reach it natively, by different paths.

- **Cursor** loads a root `AGENTS.md` as zero-config always-on context (its native equivalent of an `alwaysApply: true` rule). No `.cursor` wrapper is needed or wanted for it.
- **OpenCode** loads a root `AGENTS.md` always-on, traversing up from the working directory. (It also falls back to `CLAUDE.md` for Claude compatibility, but with `AGENTS.md` present that path is unused.)
- **Claude** reaches it through `CLAUDE.md`, whose entire content is the include `@AGENTS.md`. That include is the one repo-level invariant here: it must stay, because it is Claude's only path to the brief.

## Links and source references (resolution invariants)

- Intra-`.rules` links (`[foo](foo.md)`) and any `[[memory]]` links resolve to files that exist.
- Links from `AGENTS.md` into `.rules/` resolve.
- Source references named in rules (paths like `src/…`, package files, exported symbols) point to things that still exist. This is the tier most exposed to drift during a restructuring, and the one only judgment can catch — a moved or renamed symbol still reads as a valid link.

## AGENTS.md registry invariants

- The **Area rules** bullet list equals the set of `.rules/*.md` files.
- The **Touch → update** list covers the same set, with glob-set agreement per Tier 1.
- This file is itself listed in both (see Self-application).

## Scope — only git-tracked scaffolding

A file is a harness surface only if it is **tracked in git**. Whatever is gitignored is out of scope by construction — machine-local worktrees under `.claude/worktrees/`, `.claude/settings.local.json`, and any other `*.local` config — so there is no exclusion list to keep current; git already draws the line. (Committed-but-unnamed files like `.claude/launch.json` are shared harness config, but no invariant above names them, so nothing polices them either.)

## Self-application

This file is a harness surface and obeys the rules it defines: it has its two wrappers, its globs are the harness surfaces enumerated across the tiers above, and it appears in AGENTS.md's Area rules and Touch → update lists. A rule that governs the harness being governed by itself is ordinary self-application (a linter that lints its own config), not a paradox.

## Sync-along and enforcement

When you touch any harness surface, keep the others coherent **in the same change** so these invariants stay true — the same "Touch → update" reflex the product rules use, applied to the scaffolding. Be honest about its reliability: loading this rule on a harness edit is a **reminder**, no stronger than any always-on instruction, and reminders let drift through. The durable enforcement is a **deliberate full audit** against these invariants, run at the end of a restructuring or before a PR. That audit reports drift per tier and severity and proposes fixes; it applies them only on explicit approval.
