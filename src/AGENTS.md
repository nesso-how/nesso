# Host

## Store

- Keep Zustand state data-only in `src/store`; methods live on `NessoStore`, with `useNessoStore` for React.
- Route all public writes through `applyOperations`, including undo/redo. Keep registration and persistence diagnostics internal.
- Store operations remain synchronous and UI-free; confirmations and clipboard I/O happen outside them.
- Keep updates immutable and validate complete ordered batches before one atomic publication. Failures and net no-ops must leave state and history unchanged; preserve references to unchanged data.
- Keep document history host-owned and in memory. Restore recorded deltas rather than replaying commands against current state; exclude navigation, selection, and preferences from document history.

## Persistence

- Use the shared asynchronous persistence API; keep native file access behind the Electron bridge. Keep graph and workspace in one atomic record; preferences and conversation are separate records.
- Validate restoration and resolve saved plugin IDs before autosave. Serialize writes to preserve save order.
- Await successful saving before desktop close, update installation, or recovery reload. Web lifecycle flushes are best effort.
- Never overwrite unreadable records automatically; require explicit recovery. Report storage failures visibly and keep editing available in memory.

## Plugins and UI

- Keep registry/lifecycle in `src/plugins`, notifications in `src/notifications`, theme application in `src/theme`, and app-specific UI in `src/components/app`. Keep implementation tests nearby and contract tests in `packages/plugin/test`.
- Use the same isolated runtime for bundled and external actions; never import executable plugin modules into the host. Keep registry entries data-only, with preinstalled fallback and recovery independent of external code. Themes and vocabularies are validated JSON data, never executed.
- Require authorization bound to exact received content and declarations before executing received code; keep product confirmations separate from authorization.
- Validate raw channel requests against accepted declarations, instance identity, and execution mode. Project only authorized data and reject undeclared access without dynamic permission prompts.
- Revoke channels before teardown or replacement, cancel pending interactions, and ignore late replies without relying on plugin cleanup. Removing or failing a plugin must not delete document data.
- Apply only validated theme tokens/fonts to host DOM; compose host overlays outside the trusted canvas.
