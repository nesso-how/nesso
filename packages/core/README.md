# @nesso-how/core

Shared application contracts for the host, trusted renderers, and plugin SDK. This internal workspace package depends on the graph schema and locale types, never on the plugin runtime or host implementation.

## API

- `GraphSnapshot`, `Selection`, `WorkspaceMap`, `Viewport`, and `WorkspaceState` describe readonly graph and workspace data. Maps own the presentation of their members.
- `viewportKey(rendererId, mapId)` identifies a viewport in `workspace.viewports` by renderer and map; `null` identifies the graph. `viewport.set` and `setViewport` accept an explicit `mapId`, defaulting to the active map when omitted.
- `NessoState`, `Preferences`, and `VocabDefinition` describe application snapshots and configuration.
- `NessoOperation` describes ordered edits submitted through `applyOperations`. Position and style operations edit the active map.
- `NessoStore` is the synchronous injected API for trusted renderers. The concrete store, validation, editing policy, persistence, and history remain host-owned.
- `Notification`, `NotificationAction`, and `Notifications` describe local host notifications, including callback-based confirmations. They are not channel messages.
- `createWriteCommands(applyOperations, created)` builds write helpers on the same atomic operation API. The supplied callbacks determine synchronous or asynchronous completion and creation results; the helper never applies edits or retries failures itself.

The plugin SDK bundles this package and exposes its own permission-limited asynchronous client. Sharing operations and snapshot types does not grant plugins access to the trusted store API.
