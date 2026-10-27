# @nesso-how/plugin

See [README.md](README.md) for usage and the public API overview.

- Own public types, manifest/message validation, and the per-instance client. Keep the runtime framework- and vocabulary-independent, without app, Electron, or plugin-implementation dependencies.
- Keep boundary data deeply readonly and serializable. Functions and DOM objects stay local to the plugin context; no mutable state drafts cross the channel.
- Expose synchronous snapshot reads/subscriptions and asynchronous typed commands, never generic mutation callbacks, host registration, or renderer-specific types.
- Client validation is not a security boundary; authorization belongs to the host.
- Route all write helpers through `applyOperations`; preserve atomic batches and explicit creation IDs. Never automatically retry mutations or treat history metadata as permission.
- Use `PluginError` for boundary failures; never expose privileged stacks, paths, or credentials in replies.
