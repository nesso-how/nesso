import { mkdir, open, readFile, rename } from 'node:fs/promises'
import path from 'node:path'
import type { PersistenceStorage } from '../shared/persistence.ts'
import { ElectronError } from './errors.ts'

export function createFileStorage(directory: string | (() => string)): PersistenceStorage {
  let queue = Promise.resolve()
  const resolve = () => typeof directory === 'string' ? directory : directory()
  return {
    read: async (section) => {
      await queue
      try {
        return JSON.parse(await readFile(path.join(resolve(), `${section}.json`), 'utf8')) as unknown
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
        throw new ElectronError([{ path: '', message: error instanceof Error ? error.message : 'File read failed' }])
      }
    },
    write: async (section, value) => {
      try {
        const text = JSON.stringify(value)
        if (text === undefined) throw new ElectronError([{ path: '', message: 'Expected a JSON record' }])
        const write = queue.then(async () => {
          const base = resolve()
          const file = path.join(base, `${section}.json`)
          if (typeof directory === 'string') await mkdir(base, { recursive: true })
          const temporary = await open(`${file}.tmp`, 'w', 0o600)
          try {
            await temporary.writeFile(text, 'utf8')
            await temporary.sync()
          } finally {
            await temporary.close()
          }
          await rename(`${file}.tmp`, file)
        })
        queue = write.catch(() => {})
        await write
      } catch (error) {
        throw new ElectronError([{ path: '', message: error instanceof Error ? error.message : 'File write failed' }])
      }
    },
  }
}
