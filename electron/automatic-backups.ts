import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readdir, readFile, realpath, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { backupSchema, type AutomaticBackupState } from '../shared/backup.ts'
import type { PersistenceStorage } from '../shared/persistence.ts'
import { createBackup } from '../src/store/backup.ts'
import type { DataLocation } from './data-location/index.ts'
import { ElectronError } from './errors.ts'
import { containsPath, syncDirectory, writeFileData } from './file-system.ts'

const copyName =
  /^nesso-auto-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/
const kept = 10
const configSchema = z.strictObject({
  version: z.literal(1),
  directory: z.string().refine(path.isAbsolute).optional(),
})
const checkDirectory = async (directory: string) => {
  if (!(await lstat(directory)).isDirectory() || (await realpath(directory)) !== directory)
    throw new ElectronError([{ path: 'backup', message: 'backupFailed' }])
}

export async function createAutomaticBackups(
  userData: string,
  storage: Pick<PersistenceStorage, 'read'>,
  appVersion: string,
  location: Pick<DataLocation, 'directory' | 'identity'>,
) {
  userData = await realpath(userData)
  const defaultDirectory = path.join(userData, 'backups')
  const configFile = path.join(userData, 'automatic-backups.json')
  const state: AutomaticBackupState = {
    directory: defaultDirectory,
    defaultDirectory,
    failed: false,
    configurationFailed: false,
  }
  let customDirectory: string | undefined
  try {
    customDirectory = configSchema.parse(JSON.parse(await readFile(configFile, 'utf8'))).directory
  } catch (error) {
    state.configurationFailed = (error as NodeJS.ErrnoException).code !== 'ENOENT'
  }
  const destination = () =>
    customDirectory ? path.join(customDirectory, `nesso-${location.identity()}`) : defaultDirectory
  state.directory = destination()
  const checkCustomDirectory = async (directory: string) => {
    const target = path.join(directory, `nesso-${location.identity()}`)
    if (
      [userData, location.directory()].some(
        (base) => containsPath(base, directory) || containsPath(base, target),
      )
    )
      throw new ElectronError([{ path: 'backup', message: 'backupDestination' }])
    await checkDirectory(directory)
  }
  const copies = async () => {
    try {
      await checkDirectory(state.directory)
      return (await readdir(state.directory, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && copyName.test(entry.name))
        .map(({ name }) => name)
        .sort()
        .reverse()
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }
  let records: string | undefined
  let queue = Promise.resolve()
  const run = <T>(operation: () => Promise<T>) => {
    const result = queue.then(operation)
    queue = result.then(
      () => {},
      () => {},
    )
    return result
  }
  const refresh = async () => {
    records = undefined
    delete state.lastBackup
    state.failed = false
    try {
      if (customDirectory) await checkCustomDirectory(customDirectory)
      const [newest] = await copies()
      if (newest) {
        const backup = backupSchema.parse(
          JSON.parse(await readFile(path.join(state.directory, newest), 'utf8')),
        )
        records = JSON.stringify(backup.records)
        state.lastBackup = backup.createdAt
      }
    } catch {
      state.failed = true
    }
  }
  await refresh()
  const directory = async () => {
    if (customDirectory) await checkCustomDirectory(customDirectory)
    await mkdir(state.directory, { recursive: !customDirectory, mode: 0o700 }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== 'EEXIST') throw error
      },
    )
    await checkDirectory(state.directory)
    return state.directory
  }
  const save = async () => {
    let text: string
    try {
      text = await createBackup(storage, appVersion)
    } catch {
      state.failed = true
      return
    }
    const backup = backupSchema.parse(JSON.parse(text))
    const current = JSON.stringify(backup.records)
    try {
      await directory()
      if (current !== records || (await copies()).length === 0) {
        const file = path.join(
          state.directory,
          `nesso-auto-${backup.createdAt.replace(/[:.]/g, '-')}-${randomUUID()}.json`,
        )
        await writeFileData(`${file}.tmp`, text)
        await rename(`${file}.tmp`, file)
        for (const name of (await copies()).slice(kept))
          await unlink(path.join(state.directory, name))
        await syncDirectory(state.directory)
        records = current
        state.lastBackup = backup.createdAt
      }
    } catch (error) {
      state.failed = true
      throw error
    }
    state.failed = false
  }
  return {
    state: () => ({ ...state }),
    directory: () => run(directory),
    capture: () => run(save),
    setDirectory: (chosen?: string) =>
      run(async () => {
        if (chosen && !(await lstat(chosen)).isDirectory())
          throw new ElectronError([{ path: 'backup', message: 'backupDestination' }])
        let directory = chosen ? await realpath(chosen) : undefined
        if (customDirectory && directory === state.directory) directory = customDirectory
        if (directory === defaultDirectory) directory = undefined
        if (directory) await checkCustomDirectory(directory)
        await writeFileData(`${configFile}.tmp`, JSON.stringify({ version: 1, directory }), false)
        await rename(`${configFile}.tmp`, configFile)
        await syncDirectory(userData)
        customDirectory = directory
        state.directory = destination()
        state.configurationFailed = false
        await refresh()
        await save().catch(() => {})
        return { ...state }
      }),
  }
}

export type AutomaticBackups = Awaited<ReturnType<typeof createAutomaticBackups>>
