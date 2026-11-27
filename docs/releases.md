# Releasing Nesso

The desktop app and [published npm packages](../scripts/release-packages.json) ship at the same version. The [plugin API and data formats](compatibility.md) are versioned independently.

## Prepare the release

1. Choose the target version, merge the changes into `main`, and check that CI passes.
2. In the main clone, fetch `origin` and its tags, fast-forward `main`, and confirm that `main` matches `origin/main` and the working tree is clean.

[git-cliff](../cliff.toml) generates [CHANGELOG.md](../CHANGELOG.md) from Conventional Commits, and GitHub publishes the entry for the release tag. Use a `BREAKING CHANGE:` footer to explain what breaks and whether users or plugin authors need to act.

### Desktop highlights

Run `pnpm release <version> --preview` to see the generated changelog entry without changing any files or touching Git.

If some changes are worth highlighting, prepare a JSON file outside the checkout with one to three short highlights in each app language (`en`, `it`, `zh-CN`), in the same order. Each highlight should explain what changes for users instead of copying the changelog, and use `**bold**` or `*italic*` sparingly. See the [example notes](../src/whats-new/notes/1.0.0-beta.25.json).

Stable highlights summarize changes since the previous stable release. An upgrade from one stable version to another shows only stable highlights, including those from skipped stable releases, while other upgrades can include prerelease highlights. Nesso shows them in a single banner, and only when it has a prior version on record and there are highlights to show. The full history stays available offline under **Help → What’s New** and **Settings → About**.

## Build and publish

Run `pnpm release <version> --highlights <file>`, or pass `--no-highlights` if there are none. The script validates the notes, saves them as `src/whats-new/notes/<version>.json` in the same commit as the versions and changelog, and then tags and pushes `main` and `v<version>` atomically. Do not create the tag by hand.

In OpenCode, `/release <version>` prepares the preview and translations, then asks for approval before publishing.

The tag triggers the [Release workflow](../.github/workflows/release.yml), which builds and verifies desktop artifacts, publishes npm packages in dependency order, and creates the GitHub release. A manual run builds and verifies without publishing. Configure the Apple signing and notarization secrets that the workflow references, and set up npm trusted publishing for each package.

Desktop updates use the `alpha`, `beta`, or stable (`latest`) channel, while npm uses `latest` even for prereleases.

## Verify publication

- Check the GitHub release for notes, installers, and update files, and confirm the new npm versions.
- The website deploys separately and pins the app version at build time, so verify its download links after that deployment.
- Before retrying, check where the run stopped. A failed push can leave a local commit and tag, and after a partial npm publish, a rerun fails on the versions already published. The GitHub release and desktop update files are published only after all packages succeed.
