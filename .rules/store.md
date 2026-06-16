# Store

`src/store/index.ts` composes a single Zustand store from slices in `src/store/slices/`. There is no other global state. Import via `import { useGraphStore } from '@/store'`.

## Slices

| Slice file            | Domain                                                                                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `graph-editing.ts`    | `nodes`, `edges`, selection, undo/redo, clipboard, `editNodeId`                                                                                                                                                      |
| `settings.ts`         | `NessoSettings`, `GraphDisplaySettings`, `setSetting`, `setGraphDisplay`                                                                                                                                             |
| `ui.ts`               | Sidebar chrome, `mentorPanelExpanded`, `inspectorCollapsed`, `viewports`, `saveViewport`, toasts/confirm                                                                                                             |
| `graph-management.ts` | `graphList`, `currentGraphId`, `loadedToken`, `missingProjects`, load/save/create/import/rename/delete graph + desktop projects (`createProject`/`openProject`/`switchProject`/`removeProject`/`markProjectMissing`) |
| `desktop-sync.ts`     | `savedFingerprint`, `externalFileConflict`, reload/keep-local disk sync                                                                                                                                              |

Shared types (`GraphMeta`, `Selection`, `Viewport`, `GraphSnapshot`) live in `src/store/types.ts`. The combined `GraphState` type is in `src/store/state.ts`.

## Shape

```ts
interface GraphState {
  nodes: Node<ConceptNodeData>[]
  edges: Edge[]
  selected: { kind: 'node' | 'edge'; id: string } | null
  selectedIds: string[]
  editNodeId: string | null
  pasteAvailable: boolean
  settings: NessoSettings
  graphDisplay: GraphDisplaySettings
  mentorPanelExpanded: boolean
  sidebarCollapsed: boolean
  sidebarDisplayOpen: boolean
  inspectorCollapsed: boolean
  viewports: Record<string, { x: number; y: number; zoom: number }>
  currentGraphId: string
  graphList: { id: string; name: string; updatedAt: number }[]
  missingProjects: string[]
  loadedToken: number
  savedFingerprint: string
  externalFileConflict: boolean
  // ... mutations below
}
```

Persistence: Zustand `persist` in `index.ts` (`ZUSTAND_PERSIST_KEY` → localStorage key `nesso`; see `src/data/storageKeys.ts`) rehydrates `settings`, `mentorPanelExpanded`, `sidebarCollapsed`, `sidebarDisplayOpen`, `inspectorCollapsed`, `currentGraphId`, `graphList`, and `viewports`. On merge, `settings` is shallow-merged so new keys pick up defaults for older blobs; legacy **`reviewBatchMax`**, **`fsrsMaxInterval`**, **`graphWorkspacePath`**, **`accent`**, and **`showLabels`** are stripped. Graph node/edge payloads live in IndexedDB (`GRAPHS_DB_NAME`, `src/store/db.ts`); load via `loadGraph`, save via `saveCurrentGraph` (debounced from `useAutoSave`).

Desktop multi-project: `settings.knownProjects` (explicitly opened folders, most-recent first) and `settings.activeProjectPath` drive the workspace. **Disk is the source of truth and IndexedDB caches only the active project** — `saveCurrentGraph` writes disk-first and mirrors the persisted (post-dedup) record into IDB; `switchProject`/`openProject`/`removeProject` flush, clear IDB, and reload from disk under `beginSuppressWatch`/`_switchingProject` guards. The sidebar **Projects section** (`SidebarProjects`, desktop-only) and the native File menu (`menu:new-project` / `menu:open-project`) drive these actions — there is no Settings tab for it. Legacy top-level keys `relationTypesPanelOpen` and `sidebarStatsOpen` are dropped on merge.

## Mutations

| Method                                                                    | Effect                                                                                                                                                      |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onNodesChange` / `onEdgesChange`                                         | React Flow change handlers (move, resize, remove)                                                                                                           |
| `updateNodeData(id, patch)`                                               | Partial update of a node's `ConceptNodeData`                                                                                                                |
| `addNode(x?, y?)`                                                         | Inserts a new concept node, selects it, sets `editNodeId` (opens inline edit), returns its id                                                               |
| `deleteNode(id)`                                                          | Removes node and all its incident edges, clears selection if needed                                                                                         |
| `addEdge(source, target, type)`                                           | Inserts a `'nesso'` edge with `sourceHandle` / `targetHandle` matching concept node handles (`out` / `in`), selects it, returns id                          |
| `updateEdgeType(id, type)`                                                | Changes the relation type on an existing edge                                                                                                               |
| `deleteEdge(id)`                                                          | Removes edge, clears selection if needed                                                                                                                    |
| `setSelected(sel)`                                                        | Sets selection (or `null` to deselect)                                                                                                                      |
| `setSelectedIds(ids)`                                                     | Multi-selection for marquee / ⌘-click workflows                                                                                                             |
| `selectAll()`                                                             | Marks every node and edge selected (fills `selectedIds`, clears the single `selected`); no-op on an empty graph; not undoable                               |
| `deleteSelection()`                                                       | Deletes the selected relation, all nodes in `selectedIds`, or the singly selected concept; clears selection                                                 |
| `setSetting(key, value)`                                                  | Updates a single `NessoSettings` field                                                                                                                      |
| `setMentorPanelExpanded(expanded)`                                        | Opens or closes the Socrates slide-up sheet (entry lives in `StatusBar`; persisted)                                                                         |
| `setSidebarCollapsed` / `setSidebarDisplayOpen` / `setInspectorCollapsed` | Sidebar + inspector chrome toggles (persisted; `setInspectorCollapsed` switches the right inspector between full panel and 52px rail)                       |
| `saveViewport(id, vp)`                                                    | Stores last React Flow viewport for a graph id (persisted); invoked from `GraphCanvas` `onMoveEnd` and from debounced `useAutoSave` when nodes/edges change |
| `loadGraphList`                                                           | Refreshes `graphList` from IndexedDB; if the DB is empty, persists every bundled `SEEDS` entry then refreshes                                               |
| `loadGraph(id)`                                                           | Switches active graph from IndexedDB; missing id may be hydrated from a bundled seed (`makeSeedRecord`); increments `loadedToken`; clears selection         |
| `saveCurrentGraph`                                                        | Persists current nodes/edges for `currentGraphId` — disk-first on desktop, mirrored into IndexedDB                                                          |
| `createGraph(name)`                                                       | New empty graph; saves, switches to it, returns id                                                                                                          |
| `importGraph(name, nodes, edges)`                                         | New graph from provided React Flow nodes/edges; persists, appends to `graphList`, switches to it, returns id                                                |
| `renameGraph(id, name)`                                                   | Updates graph name in IndexedDB and `graphList`                                                                                                             |
| `deleteGraph(id)`                                                         | Removes record from IndexedDB; if active, switches to another graph                                                                                         |

This table covers the core editing/graph mutations. The store also exposes `undo`/`redo`, clipboard (`copySelection`/`cutSelection`/`pasteSelection`), `duplicateSelection` (offset clone, no clipboard) and `reverseEdge` (swap source/target), edge-curve flip (`setEdgeCurveFlipMode`), desktop projects (`createProject`/`openProject`/`switchProject`/`removeProject`/`markProjectMissing`), and disk sync (`reloadActiveGraphFromDisk`/`keepLocalGraphChanges` plus the `externalFileConflict` setters) — see the slices for the full set.

## Selectors

Named selectors are exported from `index.ts`:

```ts
export const selectedNodeSelector = (s: GraphState) => Node<ConceptNodeData> | null
export const selectedEdgeSelector = (s: GraphState) => Edge | null
export const graphDisplaySelector = (s: GraphState) => GraphDisplaySettings
```

Use these in components — do not inline the selection look-up logic.

## Rules

- Do not add local `useState` for data that belongs in the store (node text, edge type, selection).
- New store fields go in the appropriate slice; add them to `GraphState` via the slice interface in `state.ts`.
- `graph-editing` keeps nodes+edges+selection+history+clipboard together — they share `pushHistory`.
