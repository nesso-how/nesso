# Releasing Nesso

The desktop app and [published npm packages](../scripts/release-packages.json) ship at the same version. [Plugin API and data formats](compatibility.md) are versioned independently.

## Prepare the release

1. Choose the target version, merge the changes into `main`, and check that CI passes.
2. In the main clone, fetch `origin` and its tags and fast-forward `main`. Confirm that `main` matches `origin/main` and the working tree is clean.

[git-cliff](../cliff.toml) generates [CHANGELOG.md](../CHANGELOG.md) from Conventional Commits. GitHub publishes the entry for the release tag. Use a `BREAKING CHANGE:` footer to explain what breaks and whether users or plugin authors need to take action.

### Desktop highlights

Run `pnpm release <version> --preview` to see the generated changelog entry without changing files or Git. If there are changes worth highlighting, prepare a JSON file outside the checkout with one to three short highlights in each app language (`en`, `it`, `zh-CN`), in the same order. Explain what changes for users rather than copying the changelog. Use `**bold**` or `*italic*` sparingly. See the [example notes](../src/whats-new/notes/1.0.0-beta.25.json).

Stable highlights summarize changes since the previous stable release. Upgrading from one stable version to another shows only stable highlights, including from skipped stable releases. Other upgrades can include prerelease highlights. Nesso shows one banner only when it has a prior version on record and there are highlights to show. The full history is available offline under **Help → What’s New** and **Settings → About**.

## Build and publish

Run `pnpm release <version> --highlights <file>` or choose `--no-highlights` if there are none. The script validates and saves the notes as `src/whats-new/notes/<version>.json` in the same commit as the versions and changelog, then tags and pushes `main` and `v<version>` atomically. Do not create the tag by hand.

In OpenCode, `/release <version>` prepares the preview and translations and asks for approval before publishing.

The tag triggers the [Release workflow](../.github/workflows/release.yml) to build and verify desktop artifacts, publish npm packages in dependency order, and create the GitHub release. A manual run builds and verifies but does not publish. Configure the Apple signing and notarization secrets referenced by the workflow and npm trusted publishing for each package.

Desktop updates use `alpha`, `beta`, or stable (`latest`). npm uses `latest` even for prereleases.

## Verify publication

- Check the GitHub release for notes, installers, and update files, and confirm the new npm versions.
- Verify the website’s download links after its separate deployment: the site pins the app version at build time.
- Before retrying, check where the run stopped. A failed push can leave a local commit and tag. After a partial npm publish, a rerun fails on versions already published; the GitHub release and desktop update files are not published until all packages succeed.
