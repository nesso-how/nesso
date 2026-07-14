# Coding conventions

## TypeScript

- Shared graph types are distributed across packages and re-exported via `src/types/graph.ts` (facade: vocab-learning + graph display types + app settings); store-only types (e.g. `Selection`) live in `src/store/types.ts`. Do not scatter type definitions across component files.
- Prefer explicit return types on exported functions and hooks.
- Use `import type` for type-only imports.

## React

- Functional components only.
- `useCallback` / `useMemo` only when the dependency is genuinely unstable (passed as a prop to a memoised child, or in a `useEffect` dep array). Do not wrap everything by default.
- CSS is inline styles or CSS custom properties. There is no CSS-modules or Tailwind setup — keep new styles consistent with the existing inline-style pattern.

## State

- Graph data (nodes, edges, selection, settings) belongs in the Zustand store, not in local `useState`. [components.md](components.md) and [store.md](store.md) defer here.
- Local state is fine for purely UI concerns: panel open/close, draft input text, animation triggers. Mentor chat history is also local — per AGENTS.md → Constraints.

## Naming

- Components: PascalCase, one per file, filename matches component name.
- Store selectors: `<noun>Selector` suffix, exported from `store/index.ts`.
- Relation type constants: `RELATION_TYPES` + `RELATION_CATEGORIES` (`@nesso-how/vocab-learning`); `RELATION_CATEGORY_COLORS` maps category ids to `color: var(--cat-<category>)` in `data/relationTypes.ts`; labels/subtitles in i18n.

## Imports

Path alias `@/` maps to `src/`. Use it for all non-relative imports (e.g. `import { useGraphStore } from '@/store'`).

## No comments

Follow the project default: no comments unless the reason is genuinely non-obvious to a future reader. Identifiers should be self-describing.
