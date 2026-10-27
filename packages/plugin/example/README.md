# Uppercase labels

The official Nesso action plugin example, published as [`@nesso-how/plugin-example`](https://www.npmjs.com/package/@nesso-how/plugin-example). It uppercases labels in the invoked view with one undoable batch. Shared concepts change in every view containing them.

## Install and try

In the desktop app, open Settings → Plugins, search for `@nesso-how/plugin-example`, and install it. Approve its declared access to concept labels.

Run **Uppercase labels** from a view's context menu in the Explorer, or from the view's actions in the Inspector with no concepts or relations selected. Use Undo to restore the original labels.

## Build your own

Copy this example into a separate project, then install dependencies and build:

```sh
npm install
npm run build
```

The build typechecks `src/index.ts` and bundles it with the package metadata into a self-contained `dist/index.js`.

Choose your own package name and action ID before publishing a derived plugin.

## Test an unpublished build

Open `package.json` and `dist/index.js` in a text editor. In desktop DevTools, set `manifest` to the parsed package JSON and `compiledCode` to the bundled JavaScript as a string:

```ts
const result = await window.nessoPlugins.propose(
  crypto.randomUUID(),
  { manifest, files: [{ path: manifest.nesso.entry, bytes: new TextEncoder().encode(compiledCode) }] },
  'en'
)
```

Approve the Nesso access dialog. Installation persists. On success, `result.value` contains the installed package; it is `null` if approval is declined. Failures return `result.issues`. To replace a build, pass the installed package's `contentId` as the fourth argument; development proposals require fresh approval.
