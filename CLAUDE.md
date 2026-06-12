@AGENTS.md

## Claude Code

Detailed rules use a single source of truth: canonical content in [`.rules/`](.rules/), with thin per-tool wrappers. For Claude Code, the **path-scoped wrappers** in [`.claude/rules/`](.claude/rules/) auto-load the matching `.rules/` file when you open files in that area — store, components, graph model, mentor, conventions, changelog.

Two situational rules have no file trigger; read the canonical file when the task calls for it:

- Opening, drafting, or updating a PR → [`.rules/pull-requests.md`](.rules/pull-requests.md)
- Keeping the `.rules/` files in sync with the codebase after code changes → [`.rules/maintenance.md`](.rules/maintenance.md)

**Release:** run `/release` to cut a release — the skill at [`.claude/skills/release/SKILL.md`](.claude/skills/release/SKILL.md) bumps the synced version, rolls the changelog, and tags/pushes to trigger publishing. It is manual-only (`disable-model-invocation`), since pushing the tag publishes.

When a rule needs changing, edit the canonical `.rules/*.md` file — never the wrappers. The wrappers in `.cursor/rules/` and `.claude/rules/` carry only tool-specific frontmatter plus an import of the canonical file. The release procedure's single source is the skill's `SKILL.md`; the Cursor rule references it.
