# Compatibility

Compatibility begins with the first beta baseline: graph envelope format `1`,
learning vocabulary `0.1.0`, graph-record format `1`, and Zustand persist
format `1`.

Each data-at-rest format uses an explicit sequential ladder. Every future
version bump adds exactly one source-version migration and one immutable
replay fixture. A newer stored version is rejected rather than interpreted
by an older app.

Pre-baseline alpha data is unsupported. In particular, migration code must
not restore, strip, preserve, or alias removed `examples`, `notes`, or image
fields. The current definition-only validator rejects them.

## Three contracts

| Contract               | What it covers                                                                           | Version axis                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Data at rest**       | Graph `.json` files, IndexedDB `graph-records`, Zustand persist blob, workspace manifest | `GRAPH_FORMAT_VERSION`, `vocabulary.version`, `ZUSTAND_PERSIST_VERSION`, `GRAPH_RECORD_VERSION` |
| **Published packages** | `@nesso-how/*` on npm, MCP tool payloads                                                 | npm semver                                                                                      |
| **Runtime in-memory**  | React Flow state, UI, mentor chat                                                        | No compat — break cleanly                                                                       |

## Data-at-rest surfaces

| Surface                                                     | Version axis              | Mechanism                                                                | Migration ladder                                   |
| ----------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------- |
| Graph `.json` envelope                                      | `GRAPH_FORMAT_VERSION`    | `deserialize` → `migrateEnvelope` (schema package)                       | `ENVELOPE_MIGRATIONS` in `@nesso-how/schema`       |
| Vocabulary semantics in files                               | `VOCABULARY.version`      | `normalizeGraphDocument` → `migrateVocabulary` (app)                     | `VOCABULARY_MIGRATIONS` in `graphLoadNormalizer`   |
| IDB graph records (`GraphRecord`)                           | `recordVersion`           | `normalizeGraphRecord` on every IDB load/list                            | `GRAPH_RECORD_MIGRATIONS` in `graphLoadNormalizer` |
| IDB `reviewState` (FSRS per node)                           | none                      | separate persisted surface; merged after graph-content normalization     | tied to vocabulary ladder                          |
| IDB **schema** (object stores)                              | idb `v2` (unchanged)      | idempotent `upgrade()` bootstrap (ensure-store-exists, no ladder)        | extend `upgrade()` callback if shape changes       |
| Zustand persist blob (localStorage `nesso`)                 | `ZUSTAND_PERSIST_VERSION` | `version` + `migrate` in Zustand persist config; `migratePersistedState` | `PERSIST_MIGRATIONS` in `store/persistence.ts`     |
| Workspace manifest (`.nesso` on disk)                       | `MANIFEST_VERSION` (1)    | default-on-missing                                                       | ladder if shape changes                            |
| Width keys (`nesso-inspector-width`, `nesso-sidebar-width`) | none                      | trivial scalars                                                          | break cleanly                                      |
| Trust store (`.nesso-trusted-paths.json`)                   | none                      | JSON array of canonical paths                                            | ladder if shape changes                            |

Runtime and mentor chat remain out of scope.

## Version axes on graph files

Two separate version axes: `version` is the **envelope shape** (gated by `deserialize` in `@nesso-how/schema`); `vocabulary.version` is the **semantic vocabulary** (validated by `@nesso-how/vocab-learning` and migrated by `graphLoadNormalizer`). `@nesso-how/schema` is vocabulary-agnostic — it manages envelope structure only. `@nesso-how/vocab-learning` validates vocabulary identity and enforces the definition-only elaboration shape.

## Forward guards

Every versioned chokepoint includes a forward guard: a newer stored version is rejected with a distinct error rather than interpreted by an older app. The graph-load normalizer (`src/lib/graphLoadNormalizer.ts`) is the single app-side compatibility boundary for files, seeds, and IDB records.

## Content / review split

Graph content lives in files/IDB `graphs`; FSRS review progress lives in the separate `reviewState` object store (keyed `${graphId}:${nodeId}`). They carry independent fingerprints so review-only changes do not rewrite disk.

## Fixtures and version bumps

Released data-at-rest formats have immutable JSON fixtures co-located with their compatibility tests. Every future format or vocabulary version bump adds a fixture for the previous released source version and a sequential migration step. Never rewrite a released fixture to match current output.

See also: [graph-model.md](graph-model.md) (envelope/vocabulary ownership), [store.md](store.md) (persistence split and ladder wiring), [testing.md](testing.md) (replay-fixture conventions).
