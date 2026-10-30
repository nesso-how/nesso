# Plugin Example

The official Nesso plugin example: an **Uppercase labels** action and a React **Concept Quiz** with persistent progress. See [`src/index.ts`](src/index.ts) and [`src/Quiz.tsx`](src/Quiz.tsx).

## Install and try

In the desktop app, open Settings → Plugins, search for `@nesso-how/plugin-example`, and install it. Approve its declared access to concept labels, interactive panels, and private storage. The panel example requires the SDK and app versions containing central-panel support; build from this checkout until that SDK release is published.

Run either action from a view's context menu in the Explorer, or from its actions in the Inspector with nothing selected.

## Build your own

Copy this example into a separate project, then install dependencies and build:

```sh
npm install
npm run build
```

The Vite configuration bundles code and imported CSS into `dist/index.js`, leaving React and React DOM to Nesso. See the [UI contract](../README.md#action-ui) for runtime requirements.

Choose your own package name, plugin metadata, and action IDs and labels before publishing.

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
