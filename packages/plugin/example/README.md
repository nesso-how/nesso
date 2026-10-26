# Uppercase labels

Uppercases labels in the invoked view with one undoable batch. Shared concepts change in every view containing them.

Copy this directory outside the workspace, [pack the SDK](../README.md#sdk-development), then build:

```sh
npm install --ignore-scripts --save-dev /absolute/path/to/artifacts/nesso-plugin-0.0.0.tgz
npm run build
```

The build typechecks and bundles `src/index.ts` and its package metadata into `dist/index.js`. Choose your own package name and action ID before publishing.

To try it in desktop DevTools, set `manifest` to your parsed `package.json` and `compiledCode` to the text of `dist/index.js`:

```ts
await window.nessoPlugins.propose(
  crypto.randomUUID(),
  { manifest, files: [{ path: manifest.nesso.entry, bytes: new TextEncoder().encode(compiledCode) }] },
  'en'
)
```

Approve the Nesso access dialog. Installation persists; disable or remove it in Settings. To replace a build, pass its installed `contentId` as the fourth argument; development proposals require fresh approval.
