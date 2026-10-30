import type { BrowserWindow, Display, Rectangle } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { ElectronError } from './errors.ts'

const rectangle = z.strictObject({
  x: z.int(),
  y: z.int(),
  width: z.int().positive(),
  height: z.int().positive(),
})
const schema = z.strictObject({
  bounds: rectangle,
  display: z.strictObject({ id: z.int(), workArea: rectangle }),
  maximized: z.boolean(),
})
const report = (error: unknown) => {
  console.error(
    new ElectronError([
      { path: 'windowState', message: error instanceof Error ? error.message : String(error) },
    ]),
  )
}

type WindowDisplay = Pick<Display, 'id' | 'workArea'>

export function createWindowState(
  directory: string,
  screen: {
    getAllDisplays: () => WindowDisplay[]
    getDisplayMatching: (bounds: Rectangle) => WindowDisplay
  },
) {
  const file = path.join(directory, 'window-state.json')
  let state: z.infer<typeof schema> | undefined
  try {
    state = schema.parse(JSON.parse(readFileSync(file, 'utf8')))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') report(error)
  }
  let bounds: Partial<Rectangle> = { width: 1280, height: 800 }
  if (state) {
    const display = screen.getAllDisplays().find((display) => display.id === state.display.id)
    const area = (display ?? screen.getDisplayMatching(state.bounds)).workArea
    const width = Math.min(state.bounds.width, area.width)
    const height = Math.min(state.bounds.height, area.height)
    const x = state.bounds.x + (display ? area.x - state.display.workArea.x : 0)
    const y = state.bounds.y + (display ? area.y - state.display.workArea.y : 0)
    bounds = {
      width,
      height,
      x: Math.max(area.x, Math.min(x, area.x + area.width - width)),
      y: Math.max(area.y, Math.min(y, area.y + area.height - height)),
    }
  }
  return {
    bounds,
    maximized: state?.maximized ?? false,
    track: (window: BrowserWindow) => {
      let maximized = window.isMaximized()
      const updateMaximized = () => {
        if (!window.isMinimized()) maximized = window.isMaximized()
      }
      window.on('maximize', updateMaximized)
      window.on('unmaximize', updateMaximized)
      window.on('resize', updateMaximized)
      window.on('close', () => {
        try {
          updateMaximized()
          const { id, workArea } = screen.getDisplayMatching(window.getBounds())
          const value = { bounds: window.getNormalBounds(), display: { id, workArea }, maximized }
          writeFileSync(`${file}.tmp`, JSON.stringify(value), { mode: 0o600 })
          renameSync(`${file}.tmp`, file)
        } catch (error) {
          report(error)
        }
      })
    },
  }
}
