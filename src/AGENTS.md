# Host

## Store

- Keep Zustand state data-only in `src/store`; methods live on `NessoStore`, with `useNessoStore` for React.
- Route all public writes through `applyOperations`, including undo/redo. Keep registration and persistence diagnostics internal.
- Store operations remain synchronous and UI-free; confirmations and clipboard I/O happen outside them.
- Apply ordered operations to immutable candidates, validate the final document, reconcile derived state, and publish at most once. Failures and net no-ops must leave state and history unchanged; preserve references to unchanged data.
- Keep document history host-owned and in memory. Restore recorded deltas rather than replaying commands against current state; exclude navigation, selection, and preferences from document history.

## Persistence

- Use the shared asynchronous persistence API for IndexedDB on web and restricted Electron IPC on desktop. Keep graph and workspace in one atomic record; preferences and conversation are separate records.
- Validate restoration and resolve saved plugin IDs before autosave. Save only missing or changed records, debounce durable changes, and serialize writes. Replace desktop files atomically.
- Await successful saving before desktop close, update installation, or recovery reload. Web lifecycle flushes are best effort.
- Never overwrite unreadable records. Report storage failures visibly and keep editing available in memory.

## Plugins and UI

- Keep registry/lifecycle in `src/plugins`, notifications in `src/notifications`, theme application in `src/theme`, and app-specific UI in `src/components/app`. Keep implementation tests nearby and contract tests in `packages/plugin/test`.
- Use the same isolated runtime for bundled and external actions; never import executable plugin modules into the host. Keep registry entries data-only, with preinstalled fallback and recovery independent of external code. Themes and vocabularies are validated JSON data, never executed.
- Enforce accepted declarations on host-owned channels: validate raw requests, project only authorized data, and check entire batches before committing. Never trust the client as the security boundary.
- Require exact-content installation consent before executing received code. Reject undeclared access without dynamic permission prompts; keep product confirmations separate from authorization.
- Revoke channels before teardown or replacement, cancel pending interactions, and ignore late replies without relying on plugin cleanup. Removing or failing a plugin must not delete document data.
- Apply only validated theme tokens/fonts to host DOM; compose host overlays outside the trusted canvas.
