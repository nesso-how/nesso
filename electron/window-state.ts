import type { BrowserWindow, Rectangle } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { ElectronError } from './errors.ts'

const schema = z.strictObject({
  bounds: z.strictObject({
    x: z.int(), y: z.int(), width: z.int().positive(), height: z.int().positive(),
  }),
  maximized: z.boolean(),
})
const report = (error: unknown) => {
  console.error(new ElectronError([{ path: 'windowState', message: error instanceof Error ? error.message : String(error) }]))
}

export function createWindowState(directory: string, getWorkArea: (bounds: Rectangle) => Rectangle) {
  const file = path.join(directory, 'window-state.json')
  let state: z.infer<typeof schema> | undefined
  try {
    state = schema.parse(JSON.parse(readFileSync(file, 'utf8')))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') report(error)
  }
  let bounds: Partial<Rectangle> = { width: 1280, height: 800 }
  if (state) {
    const area = getWorkArea(state.bounds)
    const width = Math.min(state.bounds.width, area.width)
    const height = Math.min(state.bounds.height, area.height)
    bounds = {
      width, height,
      x: Math.max(area.x, Math.min(state.bounds.x, area.x + area.width - width)),
      y: Math.max(area.y, Math.min(state.bounds.y, area.y + area.height - height)),
    }
  }
  return {
    bounds,
    maximized: state?.maximized ?? false,
    track: (window: BrowserWindow) => {
      let maximized = window.isMaximized()
      window.on('maximize', () => { maximized = true })
      window.on('unmaximize', () => { if (!window.isMinimized()) maximized = false })
      window.on('close', () => {
        try {
          const value = { bounds: window.getNormalBounds(), maximized }
          writeFileSync(`${file}.tmp`, JSON.stringify(value), { mode: 0o600 })
          renameSync(`${file}.tmp`, file)
        } catch (error) {
          report(error)
        }
      })
    },
  }
}
