import assert from 'node:assert/strict'
import { ipcMain, type BrowserWindow } from 'electron'
import { build } from 'vite'
import { preparePluginPackage } from '@nesso-how/plugin/package'
import example from '../../packages/plugin/example/package.json' with { type: 'json' }
import type { Platform } from './cases.ts'
import { themeTokens, type ActionState } from '@nesso-how/plugin/runtime'
import { createBackup } from '../../src/store/backup.ts'

export type CheckContext = {
  window: BrowserWindow
  url: string
  name: Platform
  attempted: readonly string[]
}

export function connectFixtureStorage() {
  const saved = new Map<string, unknown>()
  ipcMain.handle('storage:session', () => 0)
  ipcMain.handle('storage:read', (_event, section: string) => ({ value: saved.get(section) }))
  ipcMain.handle('storage:write', (_event, section: string, value: unknown) => {
    saved.set(section, value)
    return { value: null }
  })
  ipcMain.handle('storage:backup', async () => {
    const text = await createBackup({ read: async (section) => saved.get(section) })
    saved.set(`backup:${crypto.randomUUID()}`, JSON.parse(text))
    return { value: null }
  })
  ipcMain.handle('data-location:state', () => ({
    value: {
      directory: 'test-profile',
      defaultDirectory: 'test-profile',
      moving: false,
      cleanupPending: false,
    },
  }))
  return saved
}

export async function openFixtureWorkspace(
  { window, url }: Pick<CheckContext, 'window' | 'url'>,
  persisted = true,
) {
  const saved = connectFixtureStorage()
  const evaluate = <T>(script: string) => window.webContents.executeJavaScript(script) as Promise<T>
  await window.loadURL(url)
  await waitFor(() => evaluate<boolean>(`!!document.querySelector('.intro')`), Boolean)
  await waitFor(() => evaluate<boolean>(`!document.querySelector('.splash')`), Boolean)
  await evaluate(`document.querySelector('.intro-skip').click()`)
  await waitFor(() => evaluate<boolean>(`!!document.querySelector('#canvas .react-flow')`), Boolean)
  if (!persisted) return { saved, evaluate }
  await waitFor(async () => saved.has('document'), Boolean)
  await waitFor(
    async () =>
      !!(saved.get('preferences') as { preferences?: { introSeen?: boolean } } | undefined)
        ?.preferences?.introSeen,
    Boolean,
  )
  return { saved, evaluate }
}

export async function countWorkers(window: BrowserWindow) {
  const { targetInfos } = await window.webContents.debugger.sendCommand('Target.getTargets')
  return targetInfos.filter((target: { type: string }) => target.type === 'worker').length as number
}

export const actionState = (): ActionState => ({
  revision: 0,
  contextId: 'probe',
  locale: 'en',
  theme: Object.fromEntries(themeTokens.map((token) => [token, ''])),
  conceptPlacementOffset: { x: 160, y: 100 },
  viewGraph: { concepts: [], relations: [], relationTypes: [] },
  targetViewId: null,
  workspace: { activeViewId: null, savedViews: [] },
  selected: [],
  activeVocab: null,
  history: { canUndo: false, canRedo: false },
})

export async function waitFor<T>(
  read: () => Promise<T>,
  ready: (value: T) => boolean,
  timeout = 20_000,
): Promise<T> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const value = await read()
    if (ready(value)) return value
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.fail('Plugin runtime check timed out')
}

export async function listExamplePlugin() {
  const output = await build({
    configFile: new URL('../../packages/plugin/example/vite.config.ts', import.meta.url).pathname,
    logLevel: 'silent',
    build: { write: false },
  })
  const bundle = Array.isArray(output) ? output[0] : output
  assert.ok('output' in bundle)
  const chunk = bundle.output.find((item) => item.type === 'chunk')
  assert.ok(chunk?.type === 'chunk')
  const prepared = await preparePluginPackage({
    manifest: example,
    files: [{ path: example.nesso.entry, bytes: new TextEncoder().encode(chunk.code) }],
  })
  ipcMain.handle('plugins:list', () => ({
    value: { safeMode: false, packages: [{ ...prepared, enabled: true }], issues: [] },
  }))
}

export async function chooseTab(evaluate: <T>(script: string) => Promise<T>, name: string) {
  const tab = `[...document.querySelectorAll('#canvas [role="tab"]')].find(tab=>tab.textContent.trim().startsWith(${JSON.stringify(name)}))`
  const item = `[...document.querySelectorAll('[role="menuitem"]')].find(item=>item.textContent.trim().startsWith(${JSON.stringify(name)}))`
  await waitFor(
    () =>
      evaluate<boolean>(`!!${tab} || !!document.querySelector('#canvas button.canvas-tabs-more')`),
    Boolean,
  )
  if (await evaluate<boolean>(`!!${tab}`)) return evaluate(`${tab}.click()`)
  await evaluate(`document.querySelector('#canvas button.canvas-tabs-more').click()`)
  await waitFor(() => evaluate<boolean>(`!!${item}`), Boolean)
  await evaluate(`${item}.click()`)
}

export async function panelFrame(window: BrowserWindow, readyScript: string) {
  const frame = await waitFor(async () => {
    for (const frame of window.webContents.mainFrame.framesInSubtree) {
      if (frame?.url === 'about:srcdoc' && (await frame.executeJavaScript(readyScript)))
        return frame
    }
  }, Boolean)
  assert.ok(frame)
  return frame
}
