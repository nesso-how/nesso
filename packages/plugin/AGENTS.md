# @nesso/plugin

- Never add runtime code or import the host or plugins.
- Everything crossing the contract is deeply readonly: state, snapshots, contributions, and operations. No mutable state drafts cross the contract.
- The store is the only injection channel: `PluginContext` stays `{ store }`, and `NessoStore` offers typed writes and convenience methods — no `setState`, no registration, no renderer-specific types. View and interface preferences use renderer-independent types.
- Position batches are atomic domain writes using concept ids and readonly positions, never renderer events. They publish at most once; repeated ids use the last position, and unknown ids or unchanged positions are ignored.
- `applyOperations` accepts ordered `NessoOperation` writes for graph, views, navigation, viewport, preferences, and reset, and commits atomically. Every public write helper delegates to it. Creation and reset operations require explicit stable IDs; convenience methods generate them. Do not expose generic mutation callbacks.
- Optional `historyGroup` metadata identifies one label/position interaction and never grants operations. Undo/redo commands delegate to `applyOperations` as `history.undo`/`history.redo` and require those declarations. Each history operation must be the only operation in its call. History is host-owned and shared across plugins; restore recorded effects without reconstructing original writes or recording a new edit.
- `Plugin` declares a required readonly `operations` list and a `create` factory. Empty lists allow reads only. The host enforces declarations before initialization and through every command; declarations cover explicit writes, including the documented effects of each operation, not a security sandbox.
- Theme definitions are identity metadata; do not expose components or hooks. Theme activation uses the injected store; DOM application stays in the host.
- The contract is vocabulary-agnostic: no default vocabulary, no Nesso-specific ids or types; those live in plugins.
- A vocab's `defaultTypeId` must be one of its own `relationTypes`.
