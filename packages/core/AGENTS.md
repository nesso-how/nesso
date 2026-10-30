# @nesso-how/core

See [README.md](README.md) for shared contracts and write helpers.

- Keep contracts independent of plugins, host internals, React, Electron, and renderer implementations.
- Keep the trusted synchronous store contract separate from permission-limited plugin clients. Store implementation, validation, persistence, and history belong to the host.
- Route write helpers through the injected `applyOperations`; preserve explicit creation IDs and completion semantics without retries.
