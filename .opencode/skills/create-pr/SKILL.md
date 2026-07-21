---
name: create-pr
description: Use when the user asks to open, draft, update, or push a Nesso pull request (gh pr create, gh pr edit, "crea la PR") and the branch is ready to publish on GitHub.
---

# Create a Nesso pull request

Publishes or updates a **fully prepared** PR on GitHub — not implementation, review, or committing. Assumes `preflight` and `review` have already passed, the final changes are committed by `nesso-work`, and the user has approved the PR summary; this skill only pushes and publishes.

No confirmation gate here — the orchestrator (work agent) already gated. Proceed directly.

Before creating:

```bash
gh pr list --head "$(git branch --show-current)" --state all --limit 1
```

If a PR exists, use `gh pr edit` instead of `gh pr create`.

## Gotchas

- **Never a lone "Test plan" block** — four `##` sections from `.github/PULL_REQUEST_TEMPLATE.md`, in template order.
- **Changes must describe the diff against `main`**, not a summary of PR commits. Run `git diff main...HEAD --stat` to see what changed; describe logical units, not commit messages.
- **One closing keyword per issue** (`Closes #31, #26` closes only `#31`). Keyword must directly precede `#N`. Commit-message keywords do not populate the PR linked-issues panel — put them in the **body**.
- **Rename branch only before the PR exists** — after open, rename+push auto-closes the PR. Rename worktree branches (`opencode/<random>` → `feat/<name>`) before first push.

## 1. Prepare the draft

Branch: `CONTRIBUTING.md` prefix (`feat/`, `fix/`, `refactor/`, `chore/`) + kebab-case. Body: fill template (strip HTML comments); mark checklist `[x]` only when true — `.rules/changelog.md` for `[Unreleased]`. Title: conventional-commit style.

## 2. Rebase onto `main`

```bash
git fetch origin && git rebase origin/main
```

Resolve conflicts; spot-check if needed. Prefer rebase over merging `main`.

## 3. Create or update the PR

Push the committed branch before creating or updating the PR:

```bash
git push --set-upstream origin "$(git branch --show-current)"
```

```bash
gh pr create --title "<conventional short title>" --body "$(cat <<'EOF'
## Summary
...

## Changes
- ...

## Checklist
- [ ] Branch name follows the naming convention
- [ ] `## [Unreleased]` in `CHANGELOG.md` updated

## Testing
...
EOF
)"
```

`gh pr edit <n>` for existing PRs. One `Closes #N` line per issue in the body.

## 4. Verify closing links

```bash
gh pr view <n> --json closingIssuesReferences
```

Fix body wording if any intended issue is missing.

## 5. Enable auto-merge (optional)

When the user passes `--auto` (or asks to auto-close / auto-merge the PR), enable GitHub's auto-merge after creation. This queues the PR to merge automatically once all required checks pass:

```bash
gh pr merge <n> --auto
```

- Requires branch protection with required status checks enabled on `main`.
- The PR stays open with checks pending; GitHub merges it once all required checks succeed.
- Cannot be combined with draft PRs — un-draft first (`gh pr ready <n>`).
- If the user wants squash merge strategy, pass `--squash` as well: `gh pr merge <n> --auto --squash`.
