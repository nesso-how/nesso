# Plugin Example

The official Nesso plugin example: an **Uppercase labels** action and a React **Concept Quiz** with persistent progress. See [`src/index.ts`](src/index.ts) and [`src/Quiz.tsx`](src/Quiz.tsx).

## Install and try

In the desktop app, open Settings → Plugins, search for `@nesso-how/plugin-example`, and install it. Approve its declared access to concept labels, interactive panels, and private storage. To try your own build without publishing, use the MCP workflow below instead.

Run either action from a view's context menu in the Explorer, or from its actions in the Inspector with nothing selected.

## Build your own

Use Node.js 24. Copy this example into a separate project, then install dependencies, typecheck, and build:

```sh
npm install
npm run check
npm run build
```

The Vite configuration bundles code and imported CSS into `dist/index.js`, leaving React and React DOM to Nesso. See the [UI contract](../README.md#action-ui) for runtime requirements.

Choose your own package name, plugin metadata, and action IDs and labels before installing. Keep only the permissions your plugin uses. Separate pure logic from host APIs and React so you can test it with `node:test`; see the SDK's [build and validation guide](../README.md#build-and-test) for offline `preparePluginPackage` validation of the built files.

## Test an unpublished build

1. Start the desktop MCP server in Settings → AI → MCP and connect a local coding agent such as Claude Code or Codex using the displayed URL and token. See the [connection and authoring guide](../README.md#with-a-coding-agent). Nesso's internal chat does not expose the plugin tools.
2. Have the agent read `read_docs` for `plugin` and `plugin-example`, run `plugins`, and finish the checks above in your project.
3. Tell the agent to call `propose_plugin` with your project's absolute root path, **not** its `dist` directory. For example, the tool arguments are:

```json
{ "directory": "/absolute/path/to/my-plugin" }
```

4. Switch to Nesso, review the requested access, and approve within the **120-second** request timeout.

The proposal returns `installed` with the package name, version, and content ID, `cancelled`, or `failed` with issues to fix. Installation persists across restarts; Nesso does not run npm or build scripts. No npm publication or DevTools is required.

For the next build, call `plugins` and pass your local plugin's current `contentId` as `replacing` alongside `directory`. Each replacement needs approval; rebuilding alone does not reload the plugin. npm-installed and bundled packages cannot be replaced through MCP. If you already installed the published example, use a different package name for your local copy. See the [result and replacement rules](../README.md#install-or-update-through-mcp), including what to do after a timeout.
