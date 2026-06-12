---
name: release
description: Cut a new Nesso release — bump the synced version across all package.json files, tauri.conf.json, and the Tauri Rust crate (Cargo.toml/Cargo.lock), roll the CHANGELOG [Unreleased] section into a dated version with updated link refs, then tag and push to trigger the publish workflow. Use when the user asks to cut, ship, publish, or version-bump a release.
disable-model-invocation: true
---

# Cut a release

Step-by-step procedure for releasing Nesso. Pushing the `v*` tag triggers [`.github/workflows/release.yml`](../../../.github/workflows/release.yml): npm publish of the workspace packages (Trusted Publishing / OIDC), a signed universal macOS `.dmg` desktop build, and a GitHub Release. **The tag push is the point of no return — it publishes to the public. Confirm with the user before step 5.**

For the conventions and the desktop auto-update / minisign signing details, see [`.rules/changelog.md`](../../../.rules/changelog.md); this skill executes that flow, it does not restate it.

## 0. Preconditions

- Clean working tree, on an up-to-date `main` (or the release branch the user names).
- `## [Unreleased]` in `CHANGELOG.md` already holds this release's notes — contributors fill it per PR (see CONTRIBUTING.md step 3). If it's empty, ask the user what's shipping before proceeding.
- Per AGENTS.md → Git: never commit, tag, or push without the user's explicit go-ahead. Invoking `/release` covers the prep; step 5 needs its own confirmation.

## 1. Choose the version

- `PREV` = the current version in root `package.json` (e.g. `0.1.0-alpha.28`).
- Default `NEW` = increment the alpha counter (`…-alpha.N` → `…-alpha.N+1`). For a different bump (e.g. leaving alpha), confirm the target semver with the user.
- The tag will be `vNEW`.

## 2. Bump the version everywhere — all nine must stay in sync

Set the `version` field to `NEW` in every one of these (they are all currently identical; CI fails otherwise):

- `package.json` (root)
- `packages/formats/package.json`
- `packages/graph/package.json`
- `packages/mcp/package.json`
- `packages/relation-types/package.json`
- `packages/types/package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml` — the `[package]` `version`
- `src-tauri/Cargo.lock` — the `name = "nesso"` entry's `version` (mirrors `Cargo.toml`; **not** refreshed by `pnpm install`, so edit it by hand or it drifts and the desktop build's frozen-lockfile check fails)

Inter-package deps use `workspace:*`; pnpm rewrites them to the real version at publish time, so there are no dependency ranges to edit by hand.

Sanity check after editing — every occurrence should now be `NEW`, none left on `PREV`:

```bash
grep -rn 'PREV' package.json packages/*/package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
```

## 3. Roll the CHANGELOG

In `CHANGELOG.md`:

- Move everything under `## [Unreleased]` into a new `## [NEW] - YYYY-MM-DD` section (today's date), and leave a fresh **empty** `## [Unreleased]` at the top.
- Update the link references at the bottom:
  - change `[Unreleased]: …/compare/vPREV...HEAD` → `[Unreleased]: …/compare/vNEW...HEAD`
  - add `[NEW]: https://github.com/nesso-how/nesso/compare/vPREV...vNEW`
- The `## [NEW]` heading must match `src-tauri/tauri.conf.json`'s `version` **exactly** — `release.yml` extracts the GitHub Release body from the section whose heading matches that version. A mismatch ships an empty/placeholder release body.

## 4. Refresh the lockfile and verify

- Run `pnpm install` so `pnpm-lock.yaml` picks up the new workspace versions. CI runs `--frozen-lockfile`, so a stale lockfile fails the release.
- Run `pnpm build`, `pnpm lint`, `pnpm format:check` — fix or report any failure before continuing.
- Re-check: all nine versions equal `NEW`; the `## [NEW]` heading, the two link refs, and `tauri.conf.json` agree.

## 5. Commit, tag, push — only after explicit confirmation

This publishes. Confirm with the user, then:

```bash
git add -A
git commit -m "chore(release): vNEW"
git tag vNEW
git push origin <branch>
git push origin vNEW   # this tag push is what triggers release.yml
```

## 6. After the workflow

- Watch the run (`gh run watch`, or the Actions tab). It publishes the npm packages, builds the universal macOS `.dmg`, and creates the GitHub Release plus the signed `latest.json` consumed by the desktop auto-updater.
- Confirm the GitHub Release body picked up the `## [NEW]` changelog section, and that `releases/latest/download/latest.json` resolves to this build.
