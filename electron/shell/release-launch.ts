import { readFile, rename } from 'node:fs/promises'
import path from 'node:path'
import { gt, valid } from 'semver'
import type { IpcMain } from 'electron'
import { ElectronError } from '../errors.ts'
import { logError } from '../logs.ts'
import { writeFileData } from '../file-system.ts'
import type { TrustedRequest } from '../ipc.ts'

export async function recordReleaseLaunch(directory: string, version: string) {
  const file = path.join(directory, 'latest-launched-version.txt')
  if (!valid(version)) return
  let previous: string | undefined
  try {
    const stored = await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
    if (stored !== undefined) {
      previous = stored.trim()
      if (!valid(previous))
        throw new ElectronError([{ path: 'releaseLaunch', message: 'Invalid stored version' }])
      if (!gt(version, previous)) return
    }
    await writeFileData(`${file}.tmp`, version, false)
    await rename(`${file}.tmp`, file)
    return previous
  } catch (error) {
    logError(
      error instanceof ElectronError
        ? error
        : new ElectronError([
            {
              path: 'releaseLaunch',
              message: error instanceof Error ? error.message : String(error),
            },
          ]),
    )
  }
}

export function connectReleaseLaunch(
  ipc: IpcMain,
  trusted: TrustedRequest,
  directory: string,
  version: string,
) {
  let recorded = false
  ipc.handle('whats-new:startup', (event) => {
    if (!trusted(event) || recorded) return
    recorded = true
    return recordReleaseLaunch(directory, version)
  })
}
