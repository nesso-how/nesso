---
name: release
description: Use when the user asks to cut, ship, publish, or version-bump a release.
---

# Cut a release

`scripts/release.mjs` (`pnpm release`) does the deterministic prep — the version bump across all nine files, the CHANGELOG roll, the lockfile refresh, and `build`/`lint`/`format:check`. This skill **drives that script and supervises it**: it owns the judgment the script can't make (which version, what ships, when to publish) and closes the gaps the script deliberately leaves open (the git push, branch protection, worktrees).

Pushing the `v*` tag triggers `.github/workflows/release.yml`: npm publish of the workspace packages (Trusted Publishing / OIDC), a signed and notarized universal macOS `.dmg` desktop build, a serialized unsigned x64 NSIS Windows build (the `publish-windows` job runs after macOS and merges into the same `latest.json`), and a GitHub Release. **The tag push is the point of no return — it publishes to the public. Confirm with the user before step 4.**

Release policy is part of this skill: `CHANGELOG.md` contains user-facing or
release-notable changes only, and harness-only changes stay out unless they
alter shipped behavior. Keep the root and Tauri versions, release tag, and
matching changelog heading aligned. The release workflow publishes production
web only from the exact `v*` tag after its fail-closed guards, creates the full
release, and serializes the Windows updater merge after the signed macOS
artifacts. The macOS build is signed and notarized; the Windows installer is
unsigned but its updater artifacts use the shared minisign keys. Verify all
expected release assets and the changelog body after the workflow; if only the
Windows job fails, rerun that job instead of retagging.

## 0. Preconditions

- Clean working tree, on an up-to-date `main` (or the release branch the user names). The script warns on a dirty tree and refuses `--commit` unless it's clean.
- `## [Unreleased]` in `CHANGELOG.md` already holds this release's notes — contributors fill it per PR (see CONTRIBUTING.md). The script stops if it's empty; if so, ask the user what's shipping before continuing.
- Per AGENTS.md → Git: never commit, tag, or push without the user's explicit go-ahead. Invoking this skill covers the prep; the push (step 4) needs its own confirmation.

## 1. Choose the version

- `PREV` = the current version in root `package.json` (e.g. `0.1.0-alpha.28`).
- Default `NEW` = increment the alpha counter (`…-alpha.N` → `…-alpha.N+1`). This is the script's default — no argument needed. For any other bump (e.g. leaving alpha), confirm the target semver with the user and pass it explicitly: `pnpm release 0.2.0`.
- The tag will be `vNEW`.

## 2. Run the prep script

Preview first when unsure, then run for real:

```bash
pnpm release --dry-run     # print what would change, write nothing
pnpm release [NEW]         # bump + roll changelog + pnpm install + build/lint/format, then STOP
```

What the script does:

- Bumps `version` to `NEW` in all **nine** synced files — the six `package.json`s, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock` (the `name = "nesso"` entry; `pnpm install` does **not** refresh it). It aborts on version **drift** — any file not already at `PREV` — so a forgotten file fails loudly instead of shipping out of sync.
- Rolls `CHANGELOG.md`: moves `## [Unreleased]` into `## [NEW] - YYYY-MM-DD`, leaves a fresh empty `[Unreleased]`, and updates the two link references (URL derived from the existing `[Unreleased]` ref).
- Runs `CI=true pnpm install --frozen-lockfile` (non-interactive), `pnpm build`, `pnpm lint`, `pnpm format:check`.

It then stops before any git mutation and prints the commit/tag/push commands. Flags: `--no-verify` (skip the build/lint pass), `--yes` (don't prompt on warnings), `--commit` (see step 3).

**Supervise — close the gaps:**

- If the script aborts (drift, empty `[Unreleased]`, a failing build/lint), fix the **root cause** and re-run; don't hand-edit around it.
- The list of version files lives in `JSON_VERSION_FILES` / `CARGO_VERSION_FILES` in the script. If a published package is added or removed, update the script **and** the list above so they stay the single source of truth.
- The `## [NEW]` heading must match `tauri.conf.json`'s `version` exactly — `release.yml` extracts the GitHub Release body from the section with that heading, so a mismatch ships an empty release body. The script keeps them aligned; re-check after any manual fixup.

## 3. (optional) Let the script commit and tag

Once prep is green and the user has confirmed, the script can create the commit + tag locally (it **never** pushes):

```bash
pnpm release [NEW] --commit
```

Equivalently, run the `git add`/`commit`/`tag` commands it printed. Either way the commit message is `chore(release): vNEW` and the tag is `vNEW`.

## 4. Push — the point of no return, only after explicit confirmation

This publishes. Confirm with the user, then push the release commit to `main` and the tag:

```bash
git push origin HEAD:main      # the release commit — a fast-forward of main
git push origin vNEW           # the tag push is what triggers release.yml and publishes
```

Gap-closing notes from past releases:

- **Branch protection:** `main` requires PRs + a passing status check, but a maintainer with bypass can push the release commit directly. This is a fast-forward, so it needs **no** `--force` — if a tool suggests forcing, it's wrong; plain `git push origin HEAD:main` succeeds and the remote reports `Bypassed rule violations`.
- **Worktrees:** when releasing from a git worktree, push the worktree's own `HEAD` (`git push origin HEAD:main`). Do **not** `cd` into the main checkout to push — there `HEAD` points at a different commit and the push is a silent no-op (`Everything up-to-date`).

## 5. After the workflow

- Watch the run (`gh run watch <id> --exit-status`, or the Actions tab). It publishes the npm packages, builds the signed universal macOS `.dmg` and creates the GitHub Release plus the initial signed `latest.json` (`publish`), then builds the unsigned x64 NSIS Windows installer and merges a `windows-x86_64` entry into the same `latest.json` (`publish-windows`).
- The npm job finishes in under a minute; the desktop builds are the long pole (~10 min each, macOS first, then Windows). **`publish` succeeding does not mean the release is done** — and `gh run watch` can exit 0 on a transient API hiccup. Confirm `gh run view <id>` shows `completed / success` **and** `gh release view vNEW` resolves with all expected assets before reporting success.
- Expected assets on the release: the universal macOS `.dmg`, the Windows installer `Nesso_<version>_x64-setup.exe`, the updater artifacts (macOS `.app.tar.gz` + `.sig`, Windows `.exe` + `.sig`, all minisign-signed with the same keys), and the merged `latest.json` covering both macOS and `windows-x86_64`.
- **Windows-only failure:** if `publish-windows` fails after `publish` succeeded, the macOS release is already usable — do not recreate or retag the release. Rerun only the failed job (e.g. `gh run rerun <id> --failed`); it rebuilds the Windows installer and re-merges into the existing `latest.json`.
- Confirm the GitHub Release body picked up the `## [NEW]` changelog section (and ends with the unsigned-Windows/SmartScreen note), and that `releases/latest/download/latest.json` resolves to this build.
