import assert from 'node:assert/strict'
import { ipcMain, type BrowserWindow } from 'electron'
import type { Platform } from './cases.ts'
import { themeTokens, type ActionState } from '../../packages/plugin/src/runtime.ts'

export type CheckContext = {
  window: BrowserWindow
  url: string
  name: Platform
  attempted: readonly string[]
}

export function connectFixtureStorage() {
  const saved = new Map<string, unknown>()
  ipcMain.handle('storage:read', (_event, section: string) => ({ value: saved.get(section) }))
  ipcMain.handle('storage:write', (_event, section: string, value: unknown) => { saved.set(section, value); return { value: null } })
  ipcMain.handle('data-location:state', () => ({ value: { directory: 'test-profile', defaultDirectory: 'test-profile', moving: false, cleanupPending: false } }))
  return saved
}

export async function openFixtureWorkspace({ window, url }: Pick<CheckContext, 'window' | 'url'>) {
  const saved = connectFixtureStorage()
  const evaluate = <T>(script: string) => window.webContents.executeJavaScript(script) as Promise<T>
  await window.loadURL(url)
  await waitFor(() => evaluate<boolean>(`!!document.querySelector('.intro')`), Boolean)
  await evaluate(`document.querySelector('.intro-header button').click()`)
  await waitFor(() => evaluate<boolean>(`!!document.querySelector('#canvas .react-flow')`), Boolean)
  await waitFor(async () => saved.has('document'), Boolean)
  return { saved, evaluate }
}

export async function countWorkers(window: BrowserWindow) {
  const { targetInfos } = await window.webContents.debugger.sendCommand('Target.getTargets')
  return targetInfos.filter((target: { type: string }) => target.type === 'worker').length as number
}

export const actionState = (): ActionState => ({
  revision: 0, contextId: 'probe', locale: 'en',
  theme: Object.fromEntries(themeTokens.map((token) => [token, ''])),
  conceptPlacementOffset: { x: 160, y: 100 },
  viewGraph: { concepts: [], relations: [], relationTypes: [] },
  targetViewId: null,
  workspace: { activeViewId: null, savedViews: [] },
  selected: [], activeVocab: null, history: { canUndo: false, canRedo: false },
})

export async function waitFor<T>(read: () => Promise<T>, ready: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    const value = await read()
    if (ready(value)) return value
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.fail('Plugin runtime check timed out')
}
