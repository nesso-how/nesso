# @nesso/plugin

## Boundary

- Keep the package types-only; never add runtime code or import the host or plugins. Keep the contract vocabulary-agnostic, without default vocabulary IDs or definitions.
- Everything crossing the contract is deeply readonly: state, snapshots, contributions, and operations. No mutable state drafts cross the contract.
- `PluginContext` injects `{ store, notifications }`. State writes use the store; transient notifications stay outside `applyOperations`, persistence, and history. Expose typed writes and helpers, never `setState`, generic mutation callbacks, registration, or renderer-specific types. View and interface preferences use renderer-independent types.
- Notifications support info, warning, and persistent confirmations. Plugins own localized content and confirmation callbacks; confirmations require both a primary action and a cancel action. `notify` returns an ID for `dismiss`; host and plugins use the same API.

## Operations

- Require readonly `Plugin.operations` and a `create` factory. Empty declarations grant no writes; every write helper follows the same declaration check. Declarations cover explicit writes and their documented effects, not a security sandbox.
- Keep state operations ordered and atomic. Creation and reset operations require explicit stable IDs; convenience helpers generate them.
- Position batches are atomic domain writes using concept IDs and readonly positions, never renderer events. They publish at most once; repeated IDs use the last position, and unknown IDs or unchanged positions are ignored.
- All public write helpers delegate to `applyOperations`. Undo/redo require declared `history.undo`/`history.redo` operations, each alone in its call; history remains host-owned and shared across plugins.
- Optional `historyGroup` metadata identifies one label/position interaction and never grants operations.

## Contributions

- Theme definitions are identity metadata; do not expose components or hooks. Theme activation uses the injected store; DOM application stays in the host.
- A vocab's `defaultTypeId` must be one of its own `relationTypes`.
- Action labels accept the host-supplied locale; reuse the locale type from `@nesso/i18n`.
