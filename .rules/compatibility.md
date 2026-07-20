# Compatibility

Alpha stance: per AGENTS.md → Constraints (**No backwards-compatibility code while in alpha**). Persisted data from older alpha builds may break.

This file documents the **contracts** compatibility work will eventually formalize — migration ladders are deferred to the first beta tag.

## Three contracts

| Contract               | What it covers                                                                                                                | Version axis                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Data at rest**       | Graph `.json` files, IndexedDB (`graphs` + `reviewState`), Zustand persist blob, workspace manifest (see surface table below) | `GRAPH_FORMAT_VERSION`, `vocabulary.version`, internal persist/IDB/manifest versions |
| **Published packages** | `@nesso-how/*` on npm, MCP tool payloads                                                                                      | npm semver                                                                           |
| **Runtime in-memory**  | React Flow state, UI, mentor chat                                                                                             | No compat — break cleanly                                                            |

Only **data at rest** will get migration ladders (at beta). Package semver and MCP parity follow their own rules (see `AGENTS.md` docs/MCP section).

## Data-at-rest surfaces

"Data at rest" is not one thing — it is several persisted surfaces, each with its own version axis and current state. Migration is not only about graph JSON.

| Surface                                                      | Versioned?             | Mechanism today                                                   | Beta migration                              |
| ------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| Graph `.json` envelope (`concepts`/`relations`)              | `GRAPH_FORMAT_VERSION` | `deserialize` throws on mismatch                                  | ladder in `deserialize` (single chokepoint) |
| Vocabulary semantics in files (`relation.type`, node params) | `vocabulary.version`   | written, **not re-read**                                          | app-side ladder                             |
| IDB `graphs` store (`GraphRecord`: runtime nodes/edges)      | none                   | none — already runtime shape                                      | runtime normalizer                          |
| IDB `reviewState` store (FSRS per node)                      | none                   | none                                                              | tied to vocabulary ladder                   |
| IDB **schema** (object stores)                               | idb `v2`               | idempotent `upgrade()` bootstrap (ensure-store-exists, no ladder) | extend `upgrade()` callback                 |
| Zustand persist blob (localStorage `nesso`)                  | none                   | additive `merge` only                                             | `version` + `migrate`                       |
| Workspace manifest (`.nesso` on disk)                        | `MANIFEST_VERSION`     | default-on-missing, no ladder                                     | ladder if shape changes                     |
| Width keys (`nesso-inspector-width`, `nesso-sidebar-width`)  | none                   | none                                                              | break cleanly (trivial scalars)             |
| Trust store (`.nesso-trusted-paths.json`)                    | none                   | JSON array of canonical paths, persisted by `add_to_trust_store`  | ladder if shape changes                     |

Two distinctions that matter:

- **IDB schema vs IDB content.** `db.ts` declares the current _object stores_ via `idb`'s `upgrade` callback. This is **idempotent bootstrap** ("ensure these stores exist"), **not** a migration ladder: IndexedDB mandates a version number + upgrade transaction to create stores, but the callback carries no version history and migrates no data. It does **not** version the _shape_ of `GraphRecord` or `reviewState` records — a record-shape change is not covered.
- **File ≠ what the user loaded.** On web, IndexedDB `graphs` is authoritative, not the file. A vocabulary change at beta must migrate **three** runtime entry points that bypass `deserialize`: IDB load (`graph-management` `loadGraph`), bundled seeds (`seedGraph`), and the file path (`documentToGraph`). Those three are not funnelled through one normalizer today — unifying them is the beta-time refactor (no migration logic is built in alpha).

## Version axes on graph files

See [graph-model.md](graph-model.md) (`GRAPH_FORMAT_VERSION` envelope vs `vocabulary.version` semantics). `@nesso-how/schema` is vocabulary-agnostic; `@nesso-how/vocab-learning` validates relation types after envelope parse.

## Content / review split

See [store.md](store.md) → Persistence (graph content in files/IDB `graphs`; FSRS in `reviewState`; independent fingerprints).

## When this relaxes (beta)

At the first non-alpha tag (`0.2.0-beta.0`), the formal contract begins:

- Add an envelope migration ladder in `@nesso-how/schema` keyed on `version`, plus a distinct forward guard for files from newer app versions.
- Add a vocabulary migration ladder app-side keyed on `vocabulary.version`.
- Freeze a replay fixture per released format/vocabulary version; every future bump adds a fixture + migration step.
- Deprecation aliases become allowed for **package consumers** (one minor cycle), never for app data at rest.

Until beta, this file is the **stance**, not an implemented ladder. Beta implementation is tracked in [#82](https://github.com/nesso-how/nesso/issues/82).
