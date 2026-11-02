import { mkdir, readFile, rename } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { PersistenceSection, PersistenceStorage } from '../shared/persistence.ts'
import { createBackup } from '../src/store/backup.ts'
import { ElectronError } from './errors.ts'
import { syncDirectory, writeFileData } from './file-system.ts'

export function createFileStorage(directory: string | (() => string)): PersistenceStorage {
  let queue = Promise.resolve()
  const resolve = () => (typeof directory === 'string' ? directory : directory())
  const read = async (section: PersistenceSection) => {
    try {
      return JSON.parse(await readFile(path.join(resolve(), `${section}.json`), 'utf8')) as unknown
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw new ElectronError([
        { path: '', message: error instanceof Error ? error.message : 'File read failed' },
      ])
    }
  }
  return {
    read: async (section) => {
      await queue
      return read(section)
    },
    backup: async () => {
      const backup = queue.then(async () => {
        const base = resolve()
        const text = await createBackup({ read })
        const file = path.join(base, `nesso-backup-${randomUUID()}.json`)
        await writeFileData(`${file}.tmp`, text)
        await rename(`${file}.tmp`, file)
        await syncDirectory(base)
      })
      queue = backup.catch(() => {})
      await backup
    },
    write: async (section, value) => {
      try {
        const text = JSON.stringify(value)
        if (text === undefined)
          throw new ElectronError([{ path: '', message: 'Expected a JSON record' }])
        const write = queue.then(async () => {
          const base = resolve()
          const file = path.join(base, `${section}.json`)
          if (typeof directory === 'string') await mkdir(base, { recursive: true })
          await writeFileData(`${file}.tmp`, text, false)
          await rename(`${file}.tmp`, file)
          await syncDirectory(base)
        })
        queue = write.catch(() => {})
        await write
      } catch (error) {
        throw new ElectronError([
          { path: '', message: error instanceof Error ? error.message : 'File write failed' },
        ])
      }
    },
  }
}
