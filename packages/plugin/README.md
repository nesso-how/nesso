# @nesso/plugin

Public domain/store types, manifest/message validation, and instance-local asynchronous clients for Nesso plugins. This README documents supported behavior; public types, validators, and contract tests define the executable API. Shared host/trusted-renderer domain types are not grants of isolated-plugin authority.

## Status

The four bundled plugins use isolated execution: definition frames for Base Vocab/Kernel and interruptible workers for Import/Export. The desktop bridge acquires external actions, vocabularies, and themes from the public npm registry by exact name/version, or accepts an internal development proposal. Both use native consent and the existing isolated contexts, with persistent enable/disable and safe manual in-place updates. Themes may include bounded local WOFF2 fonts. This is infrastructure, not a user-ready npm installation flow: Settings installation controls and remaining end-to-end gates are tracked in [#197](https://github.com/nesso-how/nesso/issues/197). No MCP or AI Chat plugin-proposal tool is exposed. Renderers are not plugins: trusted [`@nesso/concept-map`](../concept-map/README.md) compiles into the app and uses direct injected synchronous APIs.

## Create a plugin

Plugins export a named `create(context)` factory. Technical declarations live under `nesso` in `package.json`; localized metadata and runtime messages live together under the top-level `i18n` field. Supported kinds are `actions`, `vocab`, and `theme`; renderer manifests and renderer-only operations are rejected. Build one self-contained browser JavaScript entry with dependencies included; no runtime dependency installation or module/chunk loading.

Start with the [standalone action example](example/README.md). It typechecks and builds outside this workspace using only the packed SDK and standard TypeScript/esbuild tooling. Import `ActionContext`, `ActionContribution`, and `NessoOperation` as types from `@nesso/plugin`; the host injects the context, so a plugin does not need to create a client or import the SDK at runtime. `PluginManifest` types the `nesso` declaration, not the whole npm package manifest. Context snapshots can contain base state during discovery; narrow with `'viewGraph' in state` before reading invocation data.

Themes and vocabularies return plain definitions, with no reads, writes, capabilities, or styles. The host validates the result and destroys the context. See [Base Vocab](../../plugins/base-vocab) and [Kernel](../../plugins/kernel); Kernel's validated tokens and local WOFF2 faces are applied by the host, not imported as plugin CSS.

For an external vocabulary, set `nesso.kind` to `vocab` and return a `VocabDefinition` with a unique contribution ID, absolute stable relation-type IRIs, and a default among its own types. For a theme, set the kind to `theme` and return a light-only `ThemeDefinition` with all required tokens. Both use empty `styles`, `reads`, `writes`, and `capabilities` arrays. Their factories receive base state only, never document data, and cannot cause effects. External contribution IDs are discovered after consent and checked against existing providers, including built-ins.

Theme font descriptors reference package-local `.woff2` paths. Include exactly those files alongside the JavaScript entry: at most 32 font files, 4 MiB each, within the 32 MiB serialized package-record budget. Fonts are included in the approved SHA-256 identity, reverified offline, and decoded by the browser before registration. Missing, extra, malformed, or undecodable fonts reject installation/update. Empty font-face arrays use host fallback stacks. No arbitrary CSS or remote font URLs are accepted.

Actions return localized descriptors and local `run({ viewId })` functions. Discovery has no document data or effects; each invocation uses a fresh worker and authorized snapshot. Snapshot reads/subscriptions are synchronous; commands and mediated file operations are asynchronous and must be awaited before returning. The host checks raw requests against accepted declarations, fixes the invocation target, and revokes effects before teardown. See [Import](../../plugins/import) and [Export](../../plugins/export).

The client includes the existing supported write helpers, sharing operation mappings with the synchronous host. Await methods such as `store.setConceptLabel`, `store.setSelection`, `store.undo`, and view commands. `addConcept`/`createView` resolve their stable IDs only after commit and snapshot synchronization; other write helpers resolve void. Helpers do not bypass declarations or combine separate calls into a transaction. Use `applyOperations` for explicit atomic batches and optional revision checks. Renderer commands and plugin reset helpers are not exposed.

### Manifest and contributions

Use the [example package.json](example/package.json) as a complete action manifest. Package `name` must be a valid lowercase npm name; `version` must be exact SemVer, including prerelease/build metadata when present. The normalized package retains only `name`, `version`, `nesso`, `i18n`, and admitted file content; unrelated npm fields, scripts, and dependencies confer no authority.

| `nesso` field | Supported value |
| --- | --- |
| `apiVersion` | `1` |
| `kind` | `actions`, `vocab`, or `theme` |
| `entry` | Relative POSIX `.js` path: slash-separated letters, digits, underscores or hyphens; no traversal, URL, percent encoding, or empty segments; maximum 240 characters |
| `styles` | `[]` |
| `reads` | `[]`, `["view"]`, or `["graph"]`; definitions require `[]` |
| `writes` | Unique supported operation kinds allowed for writes; definitions require `[]` |
| `capabilities` | Unique subset of `files.open`, `files.save`, `notifications.notify`; definitions require `[]` |

All fields above are required. Unknown `nesso` fields, duplicates, unsupported locales, renderer declarations, and nonempty styles fail validation. External packages declaring `document.reset` are rejected. No clipboard, network, arbitrary filesystem, credentials, AI, MCP, or generic IPC capability exists.

`i18n` is organized by message key, not locale. It requires `metadata: { name, description, documentation }`; each field is a `LocalizedText` object with required nonempty `en` and optional nonempty `it`/`zh-CN` plain-text strings, bounded per translation to 128 bytes, 2 KiB, and 16 KiB respectively. Other `i18n` keys are `LocalizedText` runtime messages of at most 16 KiB per translation. Other locales, bare strings, and extra nesting are rejected. The entire package manifest remains bounded to 64 KiB. The host validates these data before consent or execution and resolves each displayed message in its current locale, falling back to English independently for each key. All admitted translations are included in the approved content identity. Factories can import their own package.json at build time and pass `i18n.label` or other localized objects directly to the host; no translation library is needed. The bundler must embed the used translations in the single JavaScript entry. No package.json or translation-file loading, interpolation, or plural expansion is available at runtime.

Contribution IDs are lowercase kebab-case, at most 64 characters, unique by kind across installed and bundled providers. Actions return 1–64 `{ id, label, supportsViews, run }` records; `label` requires English and optionally Italian/Chinese plain text, at most 128 UTF-8 bytes per label. `supportsViews` adds the action to saved-view menus. The navbar binds the active view at invocation; a saved-view menu binds that view, with `null` meaning All. Contribution IDs differ from package names; vocabulary relation-type IRIs remain stable across versions and uninstall.

`metadata.name` identifies the package in Settings and installation consent; `label` names an individual action in menus. A package can expose several differently named actions. A single-action factory may use `label: i18n.metadata.name`, as the standalone example does, or use `label: i18n.label` when a command needs different wording.

Theme definitions require exactly `id`, `colors`, `metrics`, and `fonts`:

- `colors`: `background`, `foreground`, `canvas`, `sidebar`, `primary`, `primary-hover`, `primary-foreground`, `muted`, `muted-foreground`, `hover`, `pressed`, `border`, `ring`, `selection-halo`, `node-border`, `edge`, `handle`. Values are `#RRGGBB` or `#RRGGBBAA`. Background/canvas/sidebar must be opaque with relative luminance at least 0.8; foreground must be opaque with at least 4.5:1 contrast against them. Primary and primary-foreground must be opaque with at least 4.5:1 contrast.
- `metrics`: `radius-control`/`radius-object` from 0–16, in host-supplied pixels; integer `duration-state` from 0–300, in host-supplied milliseconds.
- `fonts`: `sans` and `mono`, each with `faces`; at most 32 faces combined. Each face has a local `.woff2` `path`, `[min, max]` integer `weight` from 1–1000, `style` of `normal`/`italic`, and optional `unicodeRange` of 1–64 inclusive Unicode codepoint intervals. The host generates scoped families/rules; plugins supply neither CSS nor family names.

Vocabulary definitions require exactly `id`, nonempty `relationTypes` with absolute unique IRIs and labels of at most 30 characters, and `defaultTypeId` among those types. Definitions and messages are validated as data, not trusted because they came from the SDK.

### Context and authorization

`create` receives `{ store, files, notifications, signal }`. Each invocation has an independent context and abort signal. Factories must return stable descriptors: invocation initialization must match discovery before the host enables effects. There is no persistent background instance or cross-invocation memory.

| Store method | Result |
| --- | --- |
| `getState()` | Synchronous latest readonly snapshot; stable reference until an update |
| `subscribe(listener)` | Instance-local unsubscribe function |
| `refresh()` | Latest authorized snapshot after an ordered host round-trip |
| `getViewGraph(id)` | Graph for a saved view or All (`null`), without navigation; requires `graph` access |
| `applyOperations(operations, options?)` | Promise of `{ revision, changed }`; one ordered atomic batch |
| Typed write helpers | Promises; creation resolves an ID, other helpers resolve void |

Snapshot fields depend on mode and reads:

| Access | State |
| --- | --- |
| Base; all discovery/definition instances | `revision`, opaque `contextId`, resolved `locale`, host-generated theme token strings, `conceptPlacementOffset` |
| Invoked action with `view` | Base plus target `viewGraph`, target-filtered `selected`, fixed `targetViewId`, active vocabulary, global history flags, actual `workspace.activeViewId`, and saved-view ID/name/pinned metadata |
| Invoked action with `graph` | View fields plus complete `graph`, full selection, and saved-view concept memberships |

Unauthorized fields are absent, not empty substitutes. `view` includes all graph relation-type definitions and, on All, the complete graph. No conversation, credentials, persistence diagnostics, viewport, provider registry, or concrete host store enters snapshots. Reading does not authorize writing: declared writes can affect the whole document, not just the target view. Creation uses current selection/active view; deletion may affect relations and memberships; undo/redo control shared document history and must each be alone in a batch.

The host sends the latest authorized snapshot before resolving a successful write. `getState()` after `await` includes that commit unless superseded by a later update. Empty/unchanged batches return `changed: false`. Use `options.atRevision` for snapshot-dependent computations; a mismatch rejects `stale-state` atomically. `historyGroup` is qualified by instance and never grants operations. Separate calls are separate transactions; failure does not roll back earlier committed commands.

Navigation does not change an action's target. Deleting that view or replacing/resetting the document revokes the context. Refresh after deferred file work and use `atRevision` when applying a computed plan. Never automatically retry mutations: cancellation or a lost acknowledgment cannot undo a committed write or dispatched download.

### Mediated effects and errors

Effects are available only during action execution with their declared capabilities:

| Method | Behavior |
| --- | --- |
| `files.open({ extensions, mimeTypes })` | One UTF-8 text file up to 16 MiB; returns `{ name, mediaType, text }` or `null` on cancel; never a filesystem path |
| `files.save({ name, mediaType, text })` | UTF-8 text up to 16 MiB; safe basename, no paths; returns `{ saved }`, false on cancel |
| `notifications.notify({ tone, title, description? })` | Requires `notifications.notify`; `title` and optional `description` are `LocalizedText`, resolved by the host at invocation of the method; internal plain-text `info`/`warning`, not OS notifications; resolves an instance-owned ID; no `confirm`/`dismiss` API |

The host owns picker gestures, source labels, and cancellation. Filters are hints, not validation. Desktop saves are atomic; a web fallback reporting `saved: true` means the browser accepted the download, not that it finished. Await required effects before returning. Revocation removes pending interactions and ignores late replies; completed informational feedback may remain briefly.

Failures reject with `PluginError`, carrying `code` and readonly `{ path, message }[]` issues. An action can pass an optional third constructor argument, `displayMessage: LocalizedText`, for user-facing failure text resolved by the host when reporting the error. Diagnostic issues and `Error.message` remain strings; the localized display message is bounded to 2 KiB per translation and validated across the worker channel. Omit it to display the safe diagnostic message. Failure reporting terminates the action and is not an additional notification capability. Codes are `invalid-input`, `denied`, `stale-state`, `stale-context`, `unavailable`, `cancelled`, `timeout`, `closed`, and `failed`. Undeclared requests fail without dynamic permission prompts. Errors do not expose host stacks, paths, or credentials. The client is convenience code, not the security boundary: the host validates raw messages and the complete operation batch before effects.

### Runtime limits and isolation

| Resource | Limit |
| --- | --- |
| Manifest / contribution | 64 KiB / 1 MiB UTF-8 JSON |
| Request / snapshot or read reply | 32 MiB / 64 MiB UTF-8 JSON; requests have at most 32 nesting levels |
| Operation batch | 50,000 operations, also within the request budget; no implicit splitting |
| Pending requests / request rate | 64 / 256 per second, with at most one pending host interaction |
| Notifications | 10 per minute; 5 retained per instance; each translation: title 256 bytes, description 4 KiB |
| Error | 32 issues; path 256 UTF-8 bytes, message 2,048 UTF-8 bytes |
| Initialization / ordinary RPC | 10 seconds / 30 seconds |
| Action / host interaction wait | 120 seconds excluding host waits / 5 minutes per interaction and cumulatively |

The official runner uses a token-bound host channel, a sandboxed guard and opaque child frame, and interruptible workers for actions. CSP restricts network, storage/resource access, imports, and navigation; no preload, Node, host DOM, or installer bridge is injected. The host owns authorization and revokes it before teardown/replacement; it never relies on plugin cleanup. The trusted renderer is outside this sandbox and inherits only host-validated tokens/fonts.

Message validation, ordering, replay protection and error encoding live in the runtime and channel tests, not a second public wire API. Clients should use the injected methods. Budgets bound accepted work, not allocations already made by hostile producers; frames/font parsing do not guarantee hard CPU/RAM containment or host responsiveness. Worker tests do not prove prevention of every nested worker or every browser/OS interaction.

## Development and checks

### SDK package

`pnpm --dir packages/plugin build` typechecks the public entry points and builds ESM JavaScript plus bundled declarations with tsdown. `pnpm --dir packages/plugin pack --pack-destination /absolute/output` runs that build automatically and creates `nesso-plugin-0.0.0.tgz`, without publishing. Use **pnpm pack**, not npm pack, for the SDK: pnpm applies the `publishConfig.exports` mapping from workspace TypeScript sources to compiled output. The packed package exposes `@nesso/plugin`, `@nesso/plugin/runtime`, and `@nesso/plugin/package` with explicit `types` and JavaScript targets. Internal schema utilities and schema/locale types are bundled; consumers do not need unpublished `@nesso/schema` or `@nesso/i18n` packages. Normal npm dependencies remain declared and resolvable; a plugin's own build must bundle any runtime imports it uses into its single entry.

Only `dist`, the copyable `example`, README, LICENSE, and package metadata are distributed. No host code, runners, tests, or workspace-source paths are part of the public exports. `@nesso/plugin/package` exposes `PluginPackageInput`, `PreparedPlugin`, `preparePluginPackage`, `verifyPluginPackage`, and `packageFonts` for package tooling; ordinary plugin factories only need the injected context. The SDK version remains `0.0.0` pending a separately authorized publication; packing does not publish either the SDK or the example. The package build uses the repository's Node/TypeScript toolchain; consumers can typecheck in NodeNext or bundler resolution modes without TypeScript-source import support.

### Desktop installation

For the internal desktop path, `window.nessoPlugins.propose(requestId, { manifest, files: [{ path, bytes }] }, locale)` accepts a package-manifest object and one compiled UTF-8 JavaScript entry, plus local WOFF2 entries for themes. Use a fresh UUID request ID. This is a developer bridge, not a file-install UI or an MCP tool. The main process normalizes identity/declarations, hashes a canonical metadata/file index, and shows fixed native consent with Cancel as default before any discovery. The dialog identifies the kind, declared access, theme font paths, and exact content identity. A successful result means discovery, collision/font checks, and atomic persistence completed; cancellation returns null. Cancellation racing an already committed installation reports the committed result, not a false cancellation. No dependency resolution, lifecycle scripts, compilation, or execution occurs in Electron's main process.

For public npm acquisition, `window.nessoPlugins.installNpm(requestId, { name, version }, locale, replacing?)` downloads and validates the package before entering that same consent/discovery/commit flow. `validate-npm-package-name` checks names and `semver` checks exact versions, preserving prerelease/build metadata while rejecting tags, ranges, prefixes and coercion. `npm-registry-fetch` handles HTTP and streamed SHA-512 integrity verification; `tar` parses regular archive entries in memory without filesystem extraction. Only the declared JavaScript entry and, for themes, local WOFF2 files are installed; other regular package files are bounded and never installed or executed. A theme must reference every admitted WOFF2 file in its returned definition. Archive name/version must match the requested registry version. npm source and verified integrity are retained separately from the normalized SHA-256 content identity.

This adapter accepts anonymous HTTPS requests only to `registry.npmjs.org`, including every redirect, with at most five redirects per download. It does not read npm credentials/configuration, use HTTP caching, or support private registries, Git, local paths, dependency resolution or lifecycle scripts. Limits are 64 KiB metadata/package.json, 32 MiB compressed tarball, 128 MiB decompressed archive, 1,024 entries including directories, 16 MiB per regular file, 240-byte paths and a 60-second total acquisition deadline. Links, special entries, duplicate/unsafe paths, nested compression, malformed/truncated archives, nonidentity HTTP content encodings and budget violations fail without changing installed packages. Cancellation uses the existing request ID and also covers acquisition; neither a download nor a successful integrity check authorizes execution.

Dependency audit caveat (assessed October 18, 2026): `pnpm audit --prod --audit-level high` reports one high advisory, [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp), in `http-cache-semantics@4.2.0` through `npm-registry-fetch → make-fetch-happen`, with no patched version indicated. The reported cross-user shared-cache attack path is not used by this anonymous, cacheless adapter. This is a tracked dependency warning, not a demonstrated exploit in the current adapter; the audit still fails. Reassess before enabling caching or authentication and recheck dependencies before release; no override or audit suppression is installed.

Accepted records live under `userData/plugins`, separate from movable document records. One name-hashed JSON record holds the verified package, base64-encoded theme fonts, and enabled state; content identity remains bound to exact bytes and declarations. Entry/font bytes are reverified on read; runtime descriptors and definitions are not persisted. Settings exposes origin/content identity, Enable/Disable, Stop actions, and Remove plugin. Disable and removal revoke instances and pending host interactions without changing the document. Disabled packages stay visible but contribute no actions/providers and execute no discovery at startup. Enable rediscovers the already approved bytes and checks contribution collisions and fonts before persisting activation; failure leaves the package disabled.

Available external providers appear in the existing provider selectors. Startup resolves saved provider choices only after all restored definitions are validated. Updating a provider with the same contribution ID preserves its active choice and applies the replacement, including theme/font changes. Disabling, removing, or losing an active provider falls back to the bundled provider without rewriting graph data, relation-type IRIs, selection, views, or history. Re-enabling makes the provider available again without overriding a valid current choice.

For manual updates, pass the currently installed `contentId` as the fourth argument to `propose` or `installNpm`. The package name must match; stale targets, identical content, and duplicate installs without an explicit replacement target fail. Every changed package, including reduced or unchanged access, requires fresh native exact-content consent before discovery. Failed validation, acquisition, discovery, collision checks, cancellation, or storage writes preserve the previous record and registry entry. A successful update revokes the old instances before publishing the replacement and preserves enabled state, including when updating a disabled package. The same atomic file replacement commits bytes, source integrity and enabled state; no two-record update window or migration path exists for earlier development records. Disabling/removing the target during pending acquisition/discovery cancels the proposal. npm-backed install/update controls in Settings remain deferred; there is no local-file installer.

Startup offers **Continue without external plugins** before external loading, and Settings can reload into that session-only mode after awaiting a successful save. A failed save leaves the current page and session mode unchanged, keeps edits in memory, and permits retrying. Restored entries are published together only after discovery finishes; skipping midway discards the entire restore without deleting installed records or changing the document. For recovery before reading installed records, launch the desktop executable with `--safe-plugins`; built-ins and the trusted canvas remain available even if external package storage is damaged. Close/relaunch normally to leave safe mode. Web has no proposal bridge or installed-package storage.

- `pnpm dev` builds isolated bundled plugins/runners before Vite and rebuilds affected assets on changes. The trusted canvas uses ordinary Vite compilation and hot reload.
- `pnpm test` checks schemas, channels, trusted-canvas clipboard behavior, domain behavior, and npm acquisition with the real registry-fetch transport against local fixtures, including integrity, redirect policy, archive validation, budgets and cancellation.
- `pnpm test:plugins` checks canvas/Intro behavior, file mediation, real definition/worker isolation, infinite-worker termination, external action/vocabulary/theme installation/update/rollback, font decoding, enable/disable, provider fallback, undo, offline restoration, startup skip, and removal. Consent decisions are simulated in this automated check; separate packaged macOS verification uses actual consent and native file dialogs.

Repository runtime checks use Chromium, synthetic gestures, simulated native choices, and real desktop preload/IPC/storage. They also verify localized action labels, notifications and failures, restricted host navigation, and recovery reload after successful saving without discarding edits on save failure. Earlier macOS ARM64 packaged checks used real native consent/pickers and ad-hoc signing, but predate the current contract and do not validate this source revision. Fresh packaged verification and a real published-plugin npm lifecycle remain open in [#197](https://github.com/nesso-how/nesso/issues/197). Production signing/notarization, other platforms, and updater distribution are not established by these checks.
