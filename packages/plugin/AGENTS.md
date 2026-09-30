# @nesso/plugin

- Types only: no runtime code, and never import the host, plugins, or a concrete store — all would create cycles and freeze the host implementation.
- Everything crossing the contract is deeply readonly: state, snapshots, contributions. The only mutable `Graph` exists inside an `editGraph` draft.
- The store is the only injection channel: `PluginContext` stays `{ store }`, and `NessoStore` offers domain writes only — no `setState`, no registration, no renderer-specific types.
- Position batches are atomic domain writes using concept ids and readonly positions, never renderer events. They publish at most once; repeated ids use the last position, and unknown ids or unchanged positions are ignored.
- The contract is vocabulary-agnostic: no default vocabulary, no Nesso-specific ids or types; those live in plugins.
- A vocab's `defaultTypeId` must be one of its own `relationTypes`.
