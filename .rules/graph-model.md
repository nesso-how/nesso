# Graph model

## Vocabulary and graph files

Nesso graphs are built with a declared **vocabulary** — a self-contained package of relation types, type properties, display settings, and private node parameters. The first vocabulary is the **Nesso Learning Vocabulary** (`@nesso-how/vocab-learning`), exported as `VOCABULARY`:

```ts
const VOCABULARY = {
  id: '@nesso-how/vocab-learning',
  name: 'Nesso Learning Vocabulary',
  domain: 'learning',
  version: '0.1.0', // normative vocabulary version, independent of npm package version
}
```

Graph JSON files (`NessoGraphDocument` from `@nesso-how/vocab-learning`) declare which vocabulary they use, pinning both its `id` and normative `version` so a file stays interpretable across vocabulary revisions. The envelope schema version is owned by `@nesso-how/schema` as `GRAPH_FORMAT_VERSION` — callers pass input **without** `version`; `serialize` injects it.

```ts
interface NessoGraphDocument {
  version: typeof GRAPH_FORMAT_VERSION // envelope schema version (the file format)
  vocabulary?: { id: string; version: string } // e.g. { id: '@nesso-how/vocab-learning', version: '0.1.0' }
  name: string
  concepts: Array<{
    id: string
    label: string
    x: number
    y: number
    data?: { elaboration?: ConceptElaboration }
  }>
  relations: Array<{
    id: string
    source: string
    target: string
    type?: RelationTypeName
    data?: { curveFlip?: boolean; curveFlipPinned?: boolean }
  }>
  meta?: { display: Partial<GraphDisplaySettings> }
  id?: string
  updatedAt?: number
}
```

## Envelope and vocabulary versioning

Two version axes, deliberately separate: `version` is the **envelope shape** (gated by `deserialize` in schema), `vocabulary.version` is the **semantic vocabulary** (`VOCABULARY.version`, independent of the npm package version). `@nesso-how/schema` is vocabulary-agnostic: it round-trips `concepts`/`relations` with opaque `data` and validates structure only. `@nesso-how/vocab-learning` closes the generics and validates `relation.type`. FSRS is runtime-only on nodes — not in graph files; persistence split — see [store.md](store.md) → Persistence.

**First beta baseline.** Envelope format `1` with vocabulary `0.1.0` using the post-#129 definition-only elaboration shape. `GRAPH_FORMAT_VERSION` (in `@nesso-how/schema`, currently `1`) and `VOCABULARY.version` (in `@nesso-how/vocab-learning`, currently `0.1.0`) are versioned independently — the first protected baseline pins them together.

**Ownership boundaries for compatibility:**

- `@nesso-how/schema` (`GRAPH_FORMAT_VERSION = 1`): owns the envelope ladder (`ENVELOPE_MIGRATIONS`). Rejects unversioned documents, malformed versions, and newer envelopes.
- `@nesso-how/vocab-learning` (`VOCABULARY.version = '0.1.0'`): owns strict vocabulary-identity and elaboration-shape validation. Rejects foreign vocabulary IDs, unsupported versions, and extra elaboration keys (`examples`, `notes`, image fields). Does not migrate vocabulary versions — that belongs to the app normalizer.
- App `graphLoadNormalizer` (`src/lib/graphLoadNormalizer.ts`): owns vocabulary and graph-record ladders. Calls `deserialize` (envelope) → `migrateVocabulary` → `documentToRenderGraph`. This is the single compatibility boundary for files, seeds, and IDB records.

**Sequential ladders.** Every version bump adds one source-version migration step plus one immutable replay fixture. The initial ladders are empty — the first protected baseline needs no historical steps. Future bumps fill them. See [compatibility.md](compatibility.md) for the full surface table and forward-guard contract.

## Node data (`ConceptNodeData`)

```ts
interface LearningNodeParams {
  // private dynamic node parameters (Nesso Learning Vocabulary)
  stability: number
  difficulty: number
  reps: number
  lapses: number
  fsrsState: number // ts-fsrs State: New/Learning/Review/Relearning
  due: number // Unix ms; due when <= now (0 = new / immediate)
  lastReview: number // Unix ms; 0 = never
  lastRating: number // 0 = none; 1–4 = Again/Hard/Good/Easy (matches ts-fsrs Rating)
  learningSteps?: number // FSRS learning-step index; optional for records saved before it existed
}

interface ConceptNodeData extends LearningNodeParams {
  text: string
  elaboration?: ConceptElaboration // optional definition for the concept (`{ definition: string }`)
}
```

`LearningNodeParams` and `defaultConceptReviewFields()` are defined in `@nesso-how/vocab-learning`. Use `nodeToCard()` (app, `src/types/settings.ts`) to build a ts-fsrs `Card` from persisted fields.

## Relation categories and types

All canvas edges carry a `data.type: RelationTypeName` (the semantic relation id; on disk the same value lives on `GraphRelation.type`). Relation definitions (`RELATION_TYPES`) and the ordered category list (`RELATION_CATEGORIES`) live in `@nesso-how/vocab-learning`; category labels/subtitles live in i18n; UI palette bindings (`RELATION_CATEGORY_COLORS`) map category ids to CSS vars in `src/data/relationTypes.ts`.

The set has **52 types in 8 categories**. Asymmetric relations come in **inverse pairs** so traversal in either direction is first-class.

| Category     | Forward types                                                                                         | Inverse types                                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `taxonomic`  | `subtype-of`, `instance-of`                                                                           | `has-subtype`, `has-instance`                                                                                                        |
| `structural` | `part-of`, `made-of`                                                                                  | `contains`, `composes`                                                                                                               |
| `causal`     | `causes`, `produces`, `enables`, `prevents`, `triggers`, `inhibits`, `disables`, `consumes`, `delays` | `caused-by`, `produced-by`, `enabled-by`, `prevented-by`, `triggered-by`, `inhibited-by`, `disabled-by`, `consumed-by`, `delayed-by` |
| `dependency` | `requires`, `uses`, `used-for`                                                                        | `required-by`, `used-by`, `purpose-of`                                                                                               |
| `temporal`   | `precedes`, `occurs-in`, `during`, `derives-from`, `overlaps-with`                                    | `follows`, `has-occurrence`, `spans`, `gives-rise-to`; `overlaps-with` is self (symmetric)                                           |
| `opposition` | `contrasts-with`, `opposite-of`                                                                       | self (symmetric)                                                                                                                     |
| `similarity` | `similar-to`, `analogous-to`                                                                          | self (symmetric)                                                                                                                     |
| `epistemic`  | `supports`, `explains`, `defines`, `contradicts`                                                      | `supported-by`, `explained-by`, `defined-by`; `contradicts` is self (symmetric)                                                      |

## `RelationTypeDef` schema

Each definition has:

- `cat: RelationCategory` — which category it belongs to
- `label: string` — human-readable label
- `glyph: GlyphKind` — SVG icon at the target end
- `transitive: 'Y' | 'N' | 'weak'` — `weak` = transitivity with decay; algorithms may discount per step
- `inverse: RelationTypeName | 'self'` — canonical inverse in the set; `'self'` for symmetric types (`contrasts-with`, `opposite-of`, `similar-to`, `analogous-to`, `contradicts`, `overlaps-with`)
- `strength: number` — per-type semantic weight in `0..1`. Intensity, not per-edge confidence (there is no per-edge override). Distinct types may differ by strength alone (e.g. `prevents` 0.85 vs `inhibits` 0.55).
- `polarity: -1 | 0 | 1` — signed-network polarity: `+1` positive effect, `-1` antagonistic, `0` neutral/structural
- `cardinality: '1-1' | '1-N' | 'N-1' | 'N-N'` — expected mapping pattern; `N-N` = no a-priori constraint

These properties exist to drive future graph-analysis and graph-comparison algorithms; they are studied at the type level, not assigned per edge.

## Visual encoding

`NessoEdge` renders each edge according to its `RelationTypeDef`. The amount of visual information shown depends on the `edgeEncoding` setting:

- `full` — category colour + glyph + arrowhead + always-on label
- `category` — category colour + glyph + arrowhead; label only on hover/selection
- `minimal` — plain solid neutral line — no glyph, arrowhead, label, or category colour

Category colours are CSS custom properties (`--cat-taxonomic`, `--cat-structural`, etc.) set by the active palette in `App.tsx` from `PALETTES` in `@nesso-how/vocab-learning`. Embeds use hex from `PALETTES` directly via `categoryColorMode: 'palette'`.

## React Flow edge type

Per AGENTS.md → Constraints (**Never use default React Flow edge types**). All edges use `type: 'nesso'`, rendered by `NessoEdge` from `@nesso-how/graph` (default in `NessoGraph`).
