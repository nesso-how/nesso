# Plugin Example

Two actions built with the Nesso SDK:

- **Uppercase labels** changes concept labels in the current map. See [`src/index.ts`](src/index.ts).
- **Concept Quiz** uses React to quiz you on the map's relations and saves your progress. See [`src/Quiz.tsx`](src/Quiz.tsx).

## Install and try

In the desktop app, open Settings → Plugins, search for `@nesso-how/plugin-example`, and install it, approving access to concept labels, panels, and private storage.

Run either action from a map's context menu in the Explorer, or from the map's actions in the Inspector when nothing is selected.

## Build your own

Use Node.js 24. The published npm package includes the source along with its TypeScript and Vite configurations. In the commands below, replace `X.Y.Z` with the desktop app version you target, including any prerelease suffix such as `-beta.31`. Settings → About shows this version, and the MCP server reports it too.

```sh
npm pack @nesso-how/plugin-example@X.Y.Z
mkdir my-nesso-plugin
tar -xzf nesso-how-plugin-example-X.Y.Z.tgz -C my-nesso-plugin --strip-components=1
cd my-nesso-plugin
```

If you already have a source checkout for that release, you can instead copy its `packages/plugin/example` directory into a separate project. Choose your own package name, update the metadata along with the action IDs and labels, and remove any permissions you do not use. Then install dependencies and build:

```sh
npm install
npm run build
```

The build runs TypeScript checks and then bundles code and CSS into `dist/index.js`, leaving out React and React DOM because Nesso supplies them at runtime. To typecheck without building, run `npm run check`.

See the SDK guide for [tests and package validation](../README.md#build-and-test) and for [panel APIs and styling](../README.md#action-ui).

## Test an unpublished build

Follow the SDK guide to [connect your agent](../README.md#with-an-agent) and [install through MCP](../README.md#install-or-update-through-mcp). Pass your project's absolute root path to `propose_plugin`, not its `dist` directory:

```json
{ "directory": "/absolute/path/to/my-plugin" }
```

Approve the installation in Nesso when prompted. Rebuilding does not update the installed copy, so follow the replacement procedure in the SDK guide for later builds. If the published example is already installed, give your local copy a different package name.
