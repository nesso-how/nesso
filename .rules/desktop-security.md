# Desktop security

The Tauri shell is a security boundary, not a second UI implementation.

- `src-tauri/capabilities/default.json` allows HTTPS providers and loopback HTTP only for `localhost`, `127.0.0.1`, and `::1`. It must not allow arbitrary HTTP.
- `tauri-plugin-http` builds with the `unsafe-headers` feature solely so AI requests (`src/llm/completion.ts`, the single AI networking boundary) can send an explicitly empty `Origin`, which the plugin strips instead of forcing `Origin: tauri://localhost` — Origin-rejecting local endpoints 401 otherwise. No other caller may set forbidden headers; browser builds never set `Origin`. The Cargo feature and the desktop-only empty-`Origin` sends must stay in sync.
- Filesystem operations are individually scoped to `.nesso` subtrees under `$APPDATA` and `$APPLOCALDATA`; `fs:default` is forbidden, `fs:scope` carries the same allowlist, and watch/unwatch remain scalar permissions.
- Rust owns native folder/save dialogs and export writes. The renderer never supplies an export path. Dialogs use callback-based APIs, never blocking dialog calls; synchronous writes run through `tauri::async_runtime::spawn_blocking` after dialog completion.
- `grant_fs_scope` accepts only absolute, non-root paths without `..` or hidden components except `.nesso`, and only trusted paths or app-data `.nesso` subtrees. App-data roots and the trust-store file are never grantable.
- Validate the complete picker context before side effects: reject `$HOME`, its ancestors, app-data roots and ancestors, trust-store containment, symlink components, and non-UTF-8 paths. Resolve and revalidate the canonical existing prefix before granting.
- Persist only canonical trusted paths. Grant filesystem scope before adding a path to the trust store, so failed grants leave no dangling trust entry.
- `scripts/check-security-headers.mjs` is the authority for Vercel CSP checks: common restrictive directives are required, app HTTP `connect-src` is loopback-only, and the docs policy contains no HTTP source. Do not weaken its exact-host matching.

Security changes require focused Rust or header tests and the relevant
`pnpm run preflight -- --rust` or header check before completion.
