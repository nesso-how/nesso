import type { BrowserWindow } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { ElectronError } from './errors.ts'

const schema = z.strictObject({
  version: z.literal(1),
  zoomLevel: z.number(),
})

export function connectWindowZoom(window: BrowserWindow, directory: string) {
  const file = path.join(directory, 'zoom.json')
  const report = (error: unknown) =>
    console.error(
      new ElectronError([
        { path: 'zoom', message: error instanceof Error ? error.message : String(error) },
      ]),
    )
  let zoomLevel = 0
  let writable = true
  try {
    zoomLevel = schema.parse(JSON.parse(readFileSync(file, 'utf8'))).zoomLevel
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      writable = false
      report(error)
    }
  }
  window.webContents.once('did-finish-load', () => window.webContents.setZoomLevel(zoomLevel))
  window.on('close', () => {
    if (!writable) return
    try {
      const value = schema.parse({ version: 1, zoomLevel: window.webContents.getZoomLevel() })
      writeFileSync(`${file}.tmp`, JSON.stringify(value), { mode: 0o600 })
      renameSync(`${file}.tmp`, file)
    } catch (error) {
      report(error)
    }
  })
}
