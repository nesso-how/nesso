import assert from 'node:assert/strict'
import type { BrowserWindow } from 'electron'
import type { Platform } from './cases.ts'
import { themeTokens, type BaseState } from '../../packages/plugin/src/runtime.ts'

export type CheckContext = {
  window: BrowserWindow
  url: string
  name: Platform
  attempted: readonly string[]
}

export const baseState = (): BaseState => ({
  revision: 0, contextId: 'probe', locale: 'en',
  theme: Object.fromEntries(themeTokens.map((token) => [token, ''])),
  conceptPlacementOffset: { x: 160, y: 100 },
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
