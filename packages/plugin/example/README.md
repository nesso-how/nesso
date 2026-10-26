# Uppercase labels

Uppercases labels in the invoked view with one undoable batch. Shared concepts change in every view containing them.

Copy this directory outside the workspace, then install the published SDK and build:

```sh
npm install --save-dev @nesso-how/plugin@^0.1.0
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
