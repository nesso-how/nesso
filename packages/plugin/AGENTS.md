# @nesso-how/plugin

## Boundary

- Keep supported behavior in `README.md`, public types, validators, and contract tests. Do not treat deferred APIs as implemented or duplicate protocol details in these instructions.
- Own public types, manifest/message validation, and the per-instance client. Never import the host, plugins, Electron, or a concrete store. Keep the base runtime framework- and vocabulary-independent.
- Keep boundary data deeply readonly and serializable. Functions and DOM objects stay local to the plugin context; no mutable state drafts cross the channel.
- Keep clients instance-local, with synchronous snapshot reads/subscriptions and asynchronous commands. Expose typed helpers, never generic mutation callbacks, host registration, or renderer-specific types.

## Enforcement

- The client is not a security boundary. The host authorizes raw messages against accepted declarations, instance identity, and execution mode.
- Route all write helpers through `applyOperations`; preserve atomic batches and explicit creation IDs. Never automatically retry mutations or treat history metadata as permission.
- Keep error replies structured and free of privileged stacks, paths, or credentials. Use `PluginError` following the repository's scoped-error convention.
