# Contributing

Contributions are welcome. Please follow our [Code of Conduct](CODE_OF_CONDUCT.md) in all interactions.

## Commit style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

Common types: `feat`, `fix`, `refactor`, `style`, `chore`, `docs`.  
Scope is the affected area, e.g. `canvas`, `sidebar`, `desktop`, `graph-model`.

## Branch naming

Use the same type prefix as commits:

```
feat/<name>
fix/<name>
refactor/<name>
chore/<name>
```

`<name>` is a short kebab-case summary, e.g. `feat/toast-confirm-dialog`. Rename a branch to a conforming name **before** opening its PR — renaming a branch that already has an open PR closes that PR.

## Workflow

1. Open an issue before starting non-trivial work.
2. Branch off `main` using the naming convention above, keep commits focused.
3. Update `## [Unreleased]` in `CHANGELOG.md` before committing.
4. Rebase onto the latest `main`, then open a PR using the provided template. To auto-close the issue, put a closing keyword in the PR body, one per issue — e.g. `Closes #31` (a list like `Closes #31, #26` closes only `#31`).

## Graph model changes

Proposals for new edge types or semantic categories should use the **Graph model / edge type** issue template. Changes there affect the visual encoding and the AI mentor prompts, so they warrant discussion first.
