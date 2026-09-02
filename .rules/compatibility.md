# Compatibility

## Protected baseline

The first protected data-at-rest baseline is envelope format `1`, vocabulary
`@nesso-how/vocab-learning` `0.1.0` with definition-only elaboration, graph
record format `1`, and Zustand persist format `1`. The current vocabulary is
`0.2.0`; its first ladder step is `0.1.0 → 0.2.0` for validated definition-only
sources with optional bounded notes documents.

Every data-at-rest format has an explicit sequential ladder. A future version
bump adds exactly one source-version migration and one immutable replay fixture.
Newer stored versions are rejected by older applications rather than guessed.

Pre-baseline alpha data is unsupported. Removed `examples`, alpha string
`notes`, and image fields must remain rejected everywhere: never restore,
strip, preserve, migrate, or alias them. Current `0.2.0` documents are
validated as current input, not migrated.

## Version contracts

| Surface                 | Version authority         | Compatibility boundary                                    |
| ----------------------- | ------------------------- | --------------------------------------------------------- |
| Graph JSON envelope     | `GRAPH_FORMAT_VERSION`    | `@nesso-how/schema` `deserialize` and envelope ladder     |
| Vocabulary semantics    | `VOCABULARY.version`      | `graphLoadNormalizer` vocabulary ladder                   |
| IndexedDB graph records | `recordVersion`           | `normalizeGraphRecord` in `graphLoadNormalizer`           |
| Zustand persist blob    | `ZUSTAND_PERSIST_VERSION` | `migratePersistedState` and `PERSIST_MIGRATIONS`          |
| Workspace manifest      | `MANIFEST_VERSION`        | workspace manifest loader and its ladder                  |
| Trust store             | currently unversioned     | canonical path strings; add a ladder if its shape changes |

The envelope and vocabulary axes are independent. The schema package owns only
envelope structure; the vocabulary package owns identity and elaboration shape;
the app normalizer owns vocabulary and graph-record migrations. Every versioned
chokepoint has a forward guard with a distinct rejection for newer input.

Graph content is persisted separately from FSRS review progress. Graph JSON and
the `graphs` object store contain content; `reviewState` contains per-node FSRS
state and must not be cleared or serialized as graph content. Runtime in-memory
state and mentor chat are outside the data-at-rest compatibility contract.

Released fixtures are immutable and co-located with compatibility tests. A
format or vocabulary bump adds a new previous-version fixture and replays it
through the public migration chokepoint; it never rewrites an existing fixture.
