// SPDX-License-Identifier: MIT
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { $, $$, browser } from '@wdio/globals'

/**
 * Native e2e helpers (tauri-driver lane). Unlike the Playwright lane, these run
 * the real Tauri shell, so the test process talks to the same on-disk workspace
 * the app reads and writes. Disk is the source of truth on desktop, which is
 * exactly what this lane exists to prove.
 *
 * Graphs are identified by their on-disk node content, not by name: the sidebar
 * inline-rename flow is timing-fragile under WebKitGTK, so specs work with the
 * default-named graph a fresh "new graph" produces and locate its file by the
 * concept text it contains.
 */

/** Tauri bundle identifier from `tauri.conf.json` — names the appData folder. */
const BUNDLE_IDENTIFIER = 'dev.nesso.desktop'

/** `appDataDir()` on Linux resolves to `$XDG_DATA_HOME/<id>` (or `~/.local/share/<id>`). */
function appDataDir(): string {
  const xdg = process.env.XDG_DATA_HOME?.trim()
  const base = xdg && xdg.length > 0 ? xdg : path.join(os.homedir(), '.local', 'share')
  return path.join(base, BUNDLE_IDENTIFIER)
}

/**
 * The bundled default workspace where graph `.json` files live (`resolveWorkspace`).
 * Valid only while `settings.activeProjectPath` is unset — `resetWorkspaceDir`
 * wipes this dir but not the webview's persisted settings, so a future native
 * spec that switches projects must resolve the path from the active project.
 */
function workspaceGraphsDir(): string {
  return path.join(appDataDir(), 'graphs')
}

function graphFilePath(name: string): string {
  return path.join(workspaceGraphsDir(), `${name}.json`)
}

async function ensureWorkspaceDir(): Promise<void> {
  await mkdir(workspaceGraphsDir(), { recursive: true })
}

/** Wipe the workspace so each session starts from a known-empty disk state. */
export async function resetWorkspaceDir(): Promise<void> {
  await rm(workspaceGraphsDir(), { recursive: true, force: true })
  await mkdir(workspaceGraphsDir(), { recursive: true })
}

async function listGraphFiles(): Promise<string[]> {
  try {
    const entries = await readdir(workspaceGraphsDir())
    return entries.filter((f) => f.toLowerCase().endsWith('.json'))
  } catch {
    return []
  }
}

interface DiskGraph {
  name?: string
  nodes?: { data?: { text?: string } }[]
}

async function readDiskGraph(file: string): Promise<DiskGraph | null> {
  try {
    return JSON.parse(await readFile(path.join(workspaceGraphsDir(), file), 'utf8')) as DiskGraph
  } catch {
    // A partially written file mid-autosave; callers poll, so treat as absent.
    return null
  }
}

/** Every node text across every graph file on disk — robust to extra seed files. */
export async function nodeTextsOnDisk(): Promise<string[]> {
  const texts: string[] = []
  for (const file of await listGraphFiles()) {
    const parsed = await readDiskGraph(file)
    for (const node of parsed?.nodes ?? []) {
      if (typeof node.data?.text === 'string') texts.push(node.data.text)
    }
  }
  return texts
}

/** Filename stem (no `.json`) of the graph whose nodes contain `text`, or null. */
export async function graphFileStemContaining(text: string): Promise<string | null> {
  for (const file of await listGraphFiles()) {
    const parsed = await readDiskGraph(file)
    if (parsed?.nodes?.some((n) => n.data?.text === text)) return file.replace(/\.json$/i, '')
  }
  return null
}

/** A minimal valid Nesso graph file (one concept) for external-write scenarios. */
function makeGraphFileJson(name: string, nodeText: string): string {
  return JSON.stringify(
    {
      name,
      nodes: [
        {
          id: 'n1',
          type: 'concept',
          position: { x: 240, y: 200 },
          data: {
            text: nodeText,
            stability: 0,
            difficulty: 0,
            reps: 0,
            lapses: 0,
            fsrsState: 0,
            due: 0,
            lastReview: 0,
            lastRating: 0,
          },
        },
      ],
      edges: [],
    },
    null,
    2,
  )
}

/** Drop/overwrite a graph file in the workspace from outside the app (external editor). */
export async function writeExternalGraph(name: string, nodeText: string): Promise<void> {
  await ensureWorkspaceDir()
  await writeFile(graphFilePath(name), makeGraphFileJson(name, nodeText), 'utf8')
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface WaitOptions {
  timeout: number
  interval: number
  message: string
}

/** Poll an async predicate until it returns true or the timeout elapses. */
export async function waitForCondition(
  predicate: () => Promise<boolean>,
  { timeout = 20_000, interval = 250, message = 'condition' }: Partial<WaitOptions> = {},
): Promise<void> {
  const deadline = Date.now() + timeout
  for (;;) {
    if (await predicate()) return
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${message}`)
    await sleep(interval)
  }
}

/** Wait for the React Flow canvas to be mounted (app booted, watcher established). */
export async function waitForAppReady(): Promise<void> {
  await $('.react-flow__pane').waitForExist({ timeout: 30_000 })
}

/**
 * Create a fresh empty graph and wait until the canvas clears. Decoupled from the
 * inline-rename input: an empty canvas (0 nodes) directly proves `createGraph`
 * ran and switched the active graph, without the fragile rename timing.
 */
export async function newEmptyGraph(): Promise<void> {
  // Waiting for the button to be clickable doubles as the app-ready gate (a cold
  // WebKitGTK session can take a while to render the chrome).
  const newGraph = $('[data-testid="sidebar-new-graph"]')
  await newGraph.waitForClickable({ timeout: 30_000 })
  await newGraph.click()
  await browser.waitUntil(async () => (await $$('.react-flow__node').length) === 0, {
    timeout: 30_000,
    timeoutMsg: 'new empty graph did not load (canvas still has nodes)',
  })
  // Dismiss the inline rename if it opened; harmless if it did not.
  await browser.keys('Escape')
  // Let the switch settle before the next interaction double-clicks the canvas.
  await sleep(500)
}

/** The default text a freshly created concept carries (en locale `canvas.newConcept`). */
export const DEFAULT_CONCEPT_TEXT = 'New concept'

/** The default name a fresh "new graph" gets (en locale `sidebar.untitled`). */
export const DEFAULT_GRAPH_NAME = 'Untitled'

/**
 * Double-click the empty canvas to add a concept. The node is created with the
 * default text; we do not drive the inline-edit input (it auto-closes under
 * WebKitGTK and is fragile to type into), so specs identify the concept by its
 * default text (asserted on disk). The double-click is retried to absorb
 * stale-element errors from React Flow re-rendering mid-action.
 */
export async function addConceptNode(): Promise<void> {
  await $('.react-flow__pane').waitForExist({ timeout: 30_000 })
  await browser.waitUntil(
    async () => {
      if ((await $$('.react-flow__node').length) > 0) return true
      try {
        await $('.react-flow__pane').doubleClick()
      } catch {
        // Stale element from a mid-render re-fetch; retry on the next tick.
      }
      return (await $$('.react-flow__node').length) > 0
    },
    { timeout: 40_000, interval: 600, timeoutMsg: 'double-click did not create a concept node' },
  )
  // The node opens in inline edit; close it (retry Escape, since a cold WebKitGTK
  // session can drop the first keypress) and confirm the node settled out of edit
  // — asserting the *visible* default label here is fragile because the label is
  // `visibility: hidden` while editing.
  await browser.waitUntil(
    async () => {
      if ((await $$('.react-flow__node input').length) > 0) {
        await browser.keys('Escape')
        return false
      }
      return (await $$('.react-flow__node').length) > 0
    },
    {
      timeout: 30_000,
      interval: 500,
      timeoutMsg: 'concept node did not settle out of inline edit',
    },
  )
}

/** Sidebar graph-list row, addressed by its display name (exact text match). */
export function graphRow(name: string): ReturnType<typeof $> {
  return $(`button=${name}`)
}

/** A rendered React Flow node carrying the given concept text. */
export function nodeByText(text: string): ReturnType<typeof $> {
  return $(`.react-flow__node*=${text}`)
}

async function conceptVisibleOnCanvas(text: string): Promise<boolean> {
  return (await $$(`.react-flow__node*=${text}`).length) > 0
}

/**
 * Poll until a concept appears on the canvas. After a native relaunch the
 * persisted `currentGraphId` may load a seed graph before disk sync finishes, so
 * retry opening the named graph row when the node is still absent.
 */
export async function waitForConceptOnCanvas(
  text: string,
  { graphName = DEFAULT_GRAPH_NAME, timeout = 60_000 } = {},
): Promise<void> {
  await browser.waitUntil(
    async () => {
      if (await conceptVisibleOnCanvas(text)) return true
      const row = graphRow(graphName)
      if (await row.isExisting()) {
        await row.click()
        await sleep(400)
      }
      return false
    },
    {
      timeout,
      interval: 500,
      timeoutMsg: `concept "${text}" to appear on canvas`,
    },
  )
}
