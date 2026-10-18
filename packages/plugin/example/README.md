# Uppercase labels

A minimal isolated action. Copy this directory outside the Nesso workspace and choose your own package name and contribution ID before publishing.

The SDK is not published by this example. To test the current source, first create its tarball from the Nesso repository:

```sh
pnpm --dir packages/plugin pack --pack-destination /absolute/path/to/artifacts
```

In your copied example, install that tarball as a development dependency:

```sh
npm install --ignore-scripts --save-dev /absolute/path/to/artifacts/nesso-plugin-0.0.0.tgz
npm run build
```

The build checks types and bundles `src/index.ts` into one browser ES module at `dist/index.js`. The SDK supplies types only in this example; Nesso injects the runtime context. Any runtime dependencies you add must also be included in this single bundle. Nesso never installs dependencies or runs package scripts.

The package.json `i18n.metadata` supplies the localized package name, description and documentation before execution. This single action uses `label: i18n.metadata.name`; packages with multiple actions can use distinct localized labels. Each message has required English and optional Italian/Simplified Chinese translations. Nesso resolves the current language with an English fallback, so no translation dependency is needed. The JSON import is bundled at build time, not loaded by Nesso at runtime.

The factory only declares an action. At invocation, it reads the host-provided target view and sends one atomic label-edit batch with the snapshot revision. A conflicting edit fails rather than retrying; one undo reverts a successful batch. Shared concepts change in every view containing them. No capabilities are requested.

## Try it locally

In the desktop app's DevTools console, provide your `package.json` as `manifest` and the text of `dist/index.js` as `compiledCode`, then call:

```ts
await window.nessoPlugins.propose(
  crypto.randomUUID(),
  {
    manifest,
    files: [{ path: manifest.nesso.entry, bytes: new TextEncoder().encode(compiledCode) }]
  },
  'en'
)
```

Only the user can approve the native exact-content consent dialog. Installation persists; Settings can disable or remove it. To replace an installed build, pass its current `contentId` as the fourth argument; every changed build needs fresh consent. This is the internal desktop development bridge, not a file installer, hot reload, or a web API.

Once the SDK is published, replace the local tarball development dependency with its published version before sharing the source. `npm pack --ignore-scripts` packages the already-built action for inspection without publishing it. The `files` list includes only the compiled entry; npm also includes its package metadata and documentation. Installing from npm in Nesso still requires an exact published package name/version and user consent; Settings install controls are not yet available.
