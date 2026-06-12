# Coding conventions

## TypeScript

- Shared graph types are defined in `@nesso-how/types` and re-exported via `src/types/graph.ts`; store-only types (e.g. `Selection`) live in `src/store/types.ts`. Do not scatter type definitions across component files.
- Prefer explicit return types on exported functions and hooks.
- Use `import type` for type-only imports.

## React

- Functional components only.
- `useCallback` / `useMemo` only when the dependency is genuinely unstable (passed as a prop to a memoised child, or in a `useEffect` dep array). Do not wrap everything by default.
- CSS is inline styles or CSS custom properties. There is no CSS-modules or Tailwind setup — keep new styles consistent with the existing inline-style pattern.

## State

- Graph data (nodes, edges, selection, settings) belongs in the Zustand store, not in local `useState`.
- Local state is fine for purely UI concerns: panel open/close, draft input text, animation triggers.

## Naming

- Components: PascalCase, one per file, filename matches component name.
- Store selectors: `<noun>Selector` suffix, exported from `store/index.ts`.
- Relation type constants: `RELATION_TYPES` + `RELATION_CATEGORY_META` (`@nesso-how/relation-types`); `RELATION_CATEGORIES` merges meta with `color: var(--cat-<category>)` in `data/relationTypes.ts`.

## Imports

Path alias `@/` maps to `src/`. Use it for all non-relative imports (e.g. `import { useGraphStore } from '@/store'`).

## No comments

Follow the project default: no comments unless the reason is genuinely non-obvious to a future reader. Identifiers should be self-describing.
