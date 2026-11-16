import type { IpcMain, NativeTheme } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { ElectronError } from '../errors.ts'
import type { TrustedRequest } from '../ipc.ts'
import { appearances } from '../../shared/appearance.ts'

const appearance = z.enum(appearances)
const schema = z.strictObject({ appearance })

export function connectAppearance(
  ipc: Pick<IpcMain, 'on'>,
  trusted: TrustedRequest,
  theme: Pick<NativeTheme, 'themeSource'>,
  directory: string,
) {
  const file = path.join(directory, 'appearance.json')
  const report = (error: unknown) =>
    console.error(
      new ElectronError([
        { path: 'appearance', message: error instanceof Error ? error.message : String(error) },
      ]),
    )
  try {
    theme.themeSource = schema.parse(JSON.parse(readFileSync(file, 'utf8'))).appearance
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') report(error)
  }
  ipc.on('appearance:set', (event, input: unknown) => {
    const parsed = appearance.safeParse(input)
    if (!trusted(event) || !parsed.success || theme.themeSource === parsed.data) return
    theme.themeSource = parsed.data
    try {
      writeFileSync(`${file}.tmp`, JSON.stringify({ appearance: parsed.data }), { mode: 0o600 })
      renameSync(`${file}.tmp`, file)
    } catch (error) {
      report(error)
    }
  })
}
