# @nesso-how/core

Shared application contracts for the host, trusted renderers, and the plugin SDK. This internal workspace package depends on the graph schema and locale types but never on the plugin runtime or the host implementation.

## API

- `GraphSnapshot`, `Selection`, `WorkspaceMap`, `Viewport`, and `WorkspaceState` describe readonly graph and workspace data. Each map owns the presentation of its members.
- `viewportKey(rendererId, mapId)` identifies a viewport in `workspace.viewports` by renderer and map, where a `null` map identifies the graph. `viewport.set` and `setViewport` accept a `mapId` and default to the active map when it is omitted.
- `NessoState`, `Preferences`, and `VocabDefinition` describe application snapshots and configuration.
- `NessoOperation` describes ordered edits submitted through `applyOperations`. Position and style operations edit the active map.
- `NessoStore` is the synchronous API injected into trusted renderers, while the host keeps the concrete store, validation, editing policy, persistence, and history.
- `Notification`, `NotificationAction`, and `Notifications` describe local host notifications, including confirmations that use callbacks, and are separate from channel messages.
- `createWriteCommands(applyOperations, created)` builds write helpers on the same atomic operation API. The supplied callbacks decide whether completion is synchronous or asynchronous and produce the creation results, while the helper never applies edits or retries failures itself.

The plugin SDK bundles this package and exposes its own asynchronous client, limited by permissions. Plugins share the operation and snapshot types, but that gives them no access to the trusted store API.
