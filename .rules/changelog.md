# Changelog

The repo keeps a root [`CHANGELOG.md`](../CHANGELOG.md) in [Keep a Changelog](https://keepachangelog.com/) style.

## Scope

Record user-facing or otherwise release-notable changes only. Changes exclusively to the AI harness — `.rules/`, `.opencode/`, `AGENTS.md`, or `opencode.json` — do not belong in `CHANGELOG.md` unless they alter shipped user-visible behavior.

## When to edit `CHANGELOG.md`

**Do not** update `CHANGELOG.md` while implementing or iterating on a feature. Leave `[Unreleased]` unchanged until commit time.

Update **`## [Unreleased]`** only when:

1. The user **explicitly asks for a git commit** — add bullets (Added / Changed / Fixed / etc.) in that commit, summarizing the changes being committed.
2. The user **explicitly asks for a changelog update before commit** (e.g. “prepare changelog for commit”) — then edit `[Unreleased]` without committing yet.

Otherwise, skip changelog edits even for user-facing work.

`[Unreleased]` is the draft for the **next** version: at release time, its contents move under `## [x.y.z] - YYYY-MM-DD` and `[Unreleased]` is reset for the next cycle.

If you later use PRs, same habit: update `[Unreleased]` when preparing the merge commit (or when the user asks), not on every intermediate push.

## Releases

- Version bumps (root `package.json`, `src-tauri/tauri.conf.json`), Git tags, and `CHANGELOG.md` sections must stay aligned.
- Link references at the bottom of `CHANGELOG.md` must be updated when cutting a release (compare URLs for the new tag).
- **GitHub Releases:** `.github/workflows/release.yml` sets the release description from the `## [<version>]` section in `CHANGELOG.md` matching `src-tauri/tauri.conf.json` `version`. Add or update that section before tagging.
- **Web production:** the public Vercel deployment follows the same pushed `v<version>` tag as desktop, not merges to `main`. `.github/workflows/release.yml` deploys the exact tagged commit only after the desktop `publish` job succeeds and `scripts/validate-release-tag.mjs` confirms the tag exactly matches the root `package.json` and `src-tauri/tauri.conf.json` versions. Pull requests and non-`main` branches retain Vercel previews; `workflow_dispatch` never deploys web production. A failed web job may be retried on the same tagged workflow run.
- **Desktop auto-updates:** the macOS build is published as a **full release** (`prerelease: false`) — not a pre-release — so the updater endpoint `releases/latest/download/latest.json` resolves to it. It ships a single universal `.dmg` plus a signed `latest.json`. Signing requires repo secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`; the matching public key lives in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). Updates only reach users already on a build that bundles the updater plugin.
