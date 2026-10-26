# @nesso-how/plugin

Types, validation, and asynchronous clients for isolated Nesso actions plus data-only vocabularies and themes. The canvas is a trusted renderer, not a plugin.

## Create a plugin

Start with the [standalone action example](example/README.md). Actions export `create(context)` and build one self-contained browser JavaScript entry, bundling any dependencies. Nesso does not install dependencies, run package scripts, compile received source, or load module graphs. Themes and vocabularies ship a JSON definition file instead; the host validates it and never executes it.

- **Actions** return `{ id, label, icon?, run }` records. `icon` is an optional `ActionIconName`: `arrow-right`, `book-open`, `clipboard-paste`, `copy`, `download`, `file-down`, `file-up`, `folder`, `globe`, `layers`, `pencil`, `play`, `plus`, `refresh`, `scissors`, `search`, `share`, `sparkles`, `upload`, `zap` (unknown keys render as `zap`). Discovery has no document access or effects; each invocation runs in a fresh worker. See [Import](../../plugins/import) and [Export](../../plugins/export).
- **Vocabularies** ship a `VocabDefinition` JSON file with stable absolute relation-type IRIs and a default among their own types. See [Base Vocab](../../plugins/base-vocab).
- **Themes** ship a light-only `ThemeDefinition` JSON file with colors, metrics, and local WOFF2 font descriptors. Include exactly the referenced fonts: at most 32 files, 4 MiB each. The host validates and applies them; arbitrary CSS and remote fonts are not supported. See [Kernel](../../plugins/kernel-theme).

Nesso injects the context. Import types such as `ActionContext` and `ActionContribution` from `@nesso-how/plugin`; there is no need to create a client yourself.

## Manifest and translations

Use the [example package.json](example/package.json). Package names must be valid npm names and versions exact SemVer. Technical declarations live under `nesso`; all fields below are required.

| `nesso` field | Supported value |
| --- | --- |
| `apiVersion` | `1` |
| `kind` | `actions`, `vocab`, or `theme` |
| `entry` | Actions: package-local `.js` path, such as `dist/index.js`. Themes and vocabularies: package-local `.json` definition path, such as `dist/definition.json` |
| `writes` | Document-content operation kinds, without duplicates |
| `capabilities` | Subset of `files.open`, `files.save`, `notifications.notify`, without duplicates |

Themes and vocabularies require empty `writes` and `capabilities`. Unknown declarations are rejected. Contribution IDs are unique by kind and use lowercase kebab-case.

The top-level `i18n.metadata` requires `name`, `description`, and `documentation`. Each is a `LocalizedText` object: `{ en: string, it?: string, 'zh-CN'?: string }`. Other `i18n` keys use the same shape. Nesso resolves the current language with an English fallback; no translation library is needed. Bundle JSON imports at build time.

Use `label: i18n.label` for an action, or reuse `i18n.metadata.name` when the wording matches. Notification titles/descriptions and `PluginError`'s optional third argument also accept localized text. Diagnostic `issues` remain `{ path, message }[]` strings.

## Action context

`create` receives `{ store, files, notifications, signal }`. Keep discovery free of effects and return stable descriptors. Actions have no persistent background instance.

- `store.getState()` and `subscribe()` are synchronous. Narrow with `'viewGraph' in state` before accessing invocation data. Actions always receive the invoked view; invoking on All exposes the complete graph.
- Await write helpers such as `setConceptLabel`, `addConcept`, and `setViewMembership`. Use `applyOperations(operations, { atRevision })` for one atomic, revision-checked batch. Separate calls are separate transactions; never retry mutations automatically.
- Receiving the invoked view is not a write sandbox. Declared writes can affect the whole document.
- `run({ viewId })` keeps its invocation target despite navigation; `null` means All. Target deletion or document reset revokes the context. Use `refresh()` after deferred work and honor `signal`.
- `files.open()`/`save()` mediate UTF-8 text files up to 16 MiB through the host, returning `null`/`{ saved: false }` on cancellation. `notifications.notify()` posts internal `info`/`warning` messages. Each effect requires its declared capability and must be awaited before returning.

Failures reject with `PluginError`, carrying `code` and bounded `issues`. Public types, validators, and tests define the full contract and limits: see `src/runtime.ts`, `src/definitions.ts`, and `test/`.

## Installation and isolation

External installation is desktop-only; web runs bundled plugins only. Publish versioned npm packages; every installation pins an exact version and the host revalidates the received files. Nesso never installs dependencies or runs package scripts. For local development, see the example's `propose` call.

Each action invocation runs in a fresh isolated worker; themes and vocabularies are validated data and never executed. Installation binds approval to the exact received content and its declarations; failed updates keep the previous installation.

The host validates requests and revokes effects before teardown. Plugins receive no Node, host DOM, credentials, arbitrary filesystem, or network access. Actions use interruptible workers; themes and vocabularies are validated data and never executed. This does not guarantee hard CPU/RAM containment or host responsiveness.

## SDK development

From the Nesso repository:

```sh
pnpm --dir packages/plugin build
pnpm --dir packages/plugin pack --pack-destination /absolute/output
```

Use **pnpm pack** so workspace exports become compiled ESM and declarations. The SDK exposes `@nesso-how/plugin` for authors, `/runtime` for runtime validation/client code, and `/package` for package tooling. Consumers do not need other Nesso workspace packages.

Run `pnpm test` for contract tests and `pnpm test:plugin-runtime` for desktop/web integration checks.
