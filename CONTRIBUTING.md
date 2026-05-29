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

## Workflow

1. Open an issue before starting non-trivial work.
2. Branch off `main` using the naming convention above, keep commits focused.
3. Update `## [Unreleased]` in `CHANGELOG.md` before committing.
4. Open a PR using the provided template.

## Graph model changes

Proposals for new edge types or semantic categories should use the **Graph model / edge type** issue template. Changes there affect the visual encoding and the AI mentor prompts, so they warrant discussion first.
