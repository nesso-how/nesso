# Pull requests

When the user asks to **open, draft, or update a PR** (including `gh pr create` / `gh pr edit`), the PR body must follow [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md). Do not substitute a different layout (e.g. a lone “Test plan” section).

## Required sections (exact headings)

Use these four `##` headings in this order. Fill every section; remove HTML comments from the template — do not leave placeholder comments in the posted body.

1. **`## Summary`** — What the PR does and why (1–3 short paragraphs or bullets).
2. **`## Changes`** — One bullet per logical change (files/features grouped, not a raw file list).
3. **`## Checklist`** — Copy the checklist from the template; mark items `[x]` only when true for this branch:
   - Branch name follows [CONTRIBUTING.md](../CONTRIBUTING.md) (`feat/`, `fix/`, `refactor/`, `chore/` + short name).
   - `## [Unreleased]` in `CHANGELOG.md` updated when the PR includes user-facing or release-note-worthy work (see [changelog](changelog.md)).
4. **`## Testing`** — How you verified the change (commands run, manual steps, screenshots note for UI).

## Linking and closing issues

To auto-close an issue on merge (and populate the PR's linked-issues panel), the **body** must contain a valid GitHub closing keyword immediately followed by `#N`.

- **Valid keywords (the only ones GitHub accepts):** `close`, `closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`, `resolves`, `resolved`.
- **Invalid (common mistakes that link nothing):** `closing #N`, `close issue #N`, or prose like "this closes the issue". The keyword must directly precede `#N`.
- **One keyword per issue.** `Closes #31, #26` closes **only** `#31`. Give each issue its own keyword — on separate lines, or repeated inline (`Closes #31, closes #26`).
- Keywords in **commit messages** close issues only on merge to the default branch and do **not** populate the PR's linked-issues panel. Always put the keywords in the **PR body** too.

Paste into the body (one keyword per issue):

```text
Closes #31
Closes #26
```

After `gh pr create`, confirm the links resolved — the output must list every issue you meant to close:

```bash
gh pr view <n> --json closingIssuesReferences
```

If an issue is missing, fix the body wording and re-check.

## Branch naming

The branch **must** follow the [CONTRIBUTING.md](../CONTRIBUTING.md) convention before you push or open the PR: a `feat/`, `fix/`, `refactor/`, or `chore/` prefix plus a short kebab-case name (e.g. `feat/toast-confirm-dialog`).

- **Worktree mode:** the harness creates an auto-generated branch like `claude/<random>`. Rename it to a conforming name with `git branch -m claude/<random> feat/<short-name>` **before** pushing or opening the PR.
- Rename **only before the PR exists.** Once a PR is open, removing/recreating its head ref (which a local rename plus push amounts to) auto-**closes** the PR. Do not rename an open PR's branch — get the name right first.
- Tick the template's **"Branch name follows the naming convention"** checkbox only when the branch actually conforms.

## Rebase onto `main` before opening

Open the PR from a branch based on **current** `main`, so the diff is clean and the PR shows no stale conflicts:

```bash
git fetch origin
git rebase origin/main
```

- Resolve any conflicts, then re-run the checks (`pnpm build`, `pnpm lint`) before opening.
- Prefer rebasing over merging `main` into the branch — it keeps history linear and avoids merge commits in the PR.
- If the branch was already pushed, the rebase rewrites history, so the next push needs `git push --force-with-lease`. Like any push, that requires the user's explicit go-ahead (see AGENTS.md → Git).

## `gh pr create`

Pass the body via a HEREDOC so markdown and checkboxes survive the shell:

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

Use a **conventional-commit-style title** (`feat:`, `fix:`, etc.) aligned with the branch and commits.

## Title vs body

- **Title**: short, conventional commit prefix + scope/description.
- **Body**: always the four sections above — never collapse “Changes” and “Testing” into a single “Test plan” block.
