# Writing docs

This file is about **how** to write pages on the Starlight docs site (`docs/src/content/docs/docs/`), not where they go. For sidebar structure, new-page placement, and MCP doc-bundle parity, see `AGENTS.md` → **Documentation and MCP parity** and **Keeping rules up to date**.

## Voice and style

- **Second person, direct address.** "You build your first graph during the tour", not "the user builds a graph" or "users can build a graph".
- **Sentence-case headings.** "Connecting a model", not "Connecting A Model".
- **Bold for UI elements**: button labels, menu items, dialog/tab names — `**Mentor**`, `**Settings → AI**`. Use the literal `->`-as-arrow notation `Settings → AI` for setting paths (a tab inside a dialog), not breadcrumbs or `>`.
- **Code spans for literal values and symbols**: file paths, env vars, exact strings the app shows or expects, keyboard glyphs (`` `⌘,` ``), JSON keys.
- **No em dash (U+2014).** Use a comma, colon, period, or rewrite the sentence instead — same rule as the rest of the project's user-facing copy.
- **Link to GitHub source sparingly.** Only link a source file when a curious reader would want to verify an implementation detail (a formula, a constant, a prompt). Don't link source for things already fully explained in prose.

## Form

- **Frontmatter**: every page needs `title` (short) and a one-sentence `description`. Both are user-facing (search, social previews) — write them as such, not as internal notes.
- **`:::caution`** for limitations and experimental-feature warnings (e.g. the mentor being off by default, the desktop build being unsigned).
- **`:::note[Title]`** for supplementary context that isn't essential to follow the main flow (e.g. the vocabulary-versioning aside on the relation-types page).
- **Tables** once a list of parameters or settings has more than ~3 fields. Below that, a bullet list reads faster.
- **Numbered lists** only for steps that must happen in sequence (an install flow, a setup walkthrough). Use bullets for unordered facts or options, even when there are several.

## When to act

- **Update the relevant page in the same change** that alters the behavior it describes. A docs change that lags the code is worse than no docs change, because it actively misleads.
- **Add or update a Troubleshooting entry in the same change** that ships a new error state, banner, or failure mode (see `docs/troubleshooting.md`).
- **Rewrite stale paragraphs to describe current behavior.** Don't append "as of vX.Y" caveats or historical asides to keep an old paragraph technically true — that's what `CHANGELOG.md` is for. A docs page always describes the present, not a changelog of itself.

## How to act

- **Check the in-app surface first.** Before documenting a feature in depth, see whether it's already shown in the app: a Settings tab with inline descriptions (`SettingsDialog`), a modal like `ShortcutsDialog` (`?`). Add only the depth that surface lacks — don't restate a tooltip or an in-app description verbatim.
- **Keep terminology consistent** with in-app copy (`src/i18n/locales/en.ts`) and the core concepts in `AGENTS.md`. If the app calls something "Mentor" or "Display", the docs use the same word, not a synonym.
- **Considered and dropped, by design**: a Settings reference page and a keyboard-shortcuts reference page are intentionally not docs pages — `SettingsDialog` and `ShortcutsDialog` are already the exhaustive, always-in-sync sources. Don't add a docs page that would just duplicate an in-app surface with no added value.
