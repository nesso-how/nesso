# @nesso/plugin

- Never add runtime code or import the host or plugins.
- Everything crossing the contract is deeply readonly: state, snapshots, contributions, and graph operations. No mutable graph drafts cross the contract.
- The store is the only injection channel: `PluginContext` stays `{ store }`, and `NessoStore` offers domain writes only — no `setState`, no registration, no renderer-specific types.
- Position batches are atomic domain writes using concept ids and readonly positions, never renderer events. They publish at most once; repeated ids use the last position, and unknown ids or unchanged positions are ignored.
- `applyOperations` accepts ordered typed domain writes and commits atomically. Creation operations require explicit stable IDs; convenience methods generate them. Do not expose generic mutation callbacks.
- Theme definitions are identity metadata; do not expose components, hooks, or store mutations.
- The contract is vocabulary-agnostic: no default vocabulary, no Nesso-specific ids or types; those live in plugins.
- A vocab's `defaultTypeId` must be one of its own `relationTypes`.
