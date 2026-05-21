# Contributing

Thank you for taking the time to contribute to Nesso, we really appreciate it. Whether you're fixing a bug, proposing a new feature, or improving the docs, every contribution matters.

All contributors are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md). Please make sure you are welcoming and respectful in all interactions.

Read the sections below to know how to report issues, propose changes, and submit code.

## Setup

```bash
pnpm install
pnpm dev          # web app
pnpm dev:desktop  # Tauri desktop
```

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

Proposals for new edge types or semantic categories should use the **Graph model / edge type** issue template — changes there affect the visual encoding and the AI mentor prompts, so they warrant discussion first.
