import { lstat, readFile, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { persistenceSections, type PersistenceSection } from '../shared/persistence.ts'
import { ElectronError } from './errors.ts'
import { syncDirectory, writeFileData } from './file-system.ts'

const journalSchema = z.strictObject({
  version: z.literal(1),
  records: z.record(z.enum(persistenceSections), z.string().nullable()),
})

export function createRecordReplacement(directory: () => string) {
  const read = async (file: string) => {
    try {
      if (!(await lstat(file)).isFile())
        throw new ElectronError([{ path: 'backup', message: 'backupRestoreFailed' }])
      return await readFile(file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }
  const write = async (file: string, text: string) => {
    const temporary = `${file}.restore-tmp`
    await writeFileData(temporary, text, false)
    await rename(temporary, file)
  }
  const cleanup = async (base: string) => {
    for (const name of [
      '.nesso-restore.json',
      ...persistenceSections.map((section) => `${section}.json`),
    ])
      await unlink(path.join(base, `${name}.restore-tmp`)).catch(() => {})
  }
  const recover = async () => {
    const base = directory()
    const journal = path.join(base, '.nesso-restore.json')
    const text = await read(journal)
    if (text === null) {
      await cleanup(base)
      return
    }
    const { records } = journalSchema.parse(JSON.parse(text))
    for (const section of persistenceSections) {
      const file = path.join(base, `${section}.json`)
      if (records[section] === null) {
        await unlink(file).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error
        })
      } else await write(file, records[section])
    }
    await syncDirectory(base)
    await cleanup(base)
    await unlink(journal)
    await syncDirectory(base)
  }
  return {
    recover,
    replace: async (records: Record<PersistenceSection, unknown>) => {
      const base = directory()
      const journal = path.join(base, '.nesso-restore.json')
      try {
        await recover()
      } catch {
        throw new ElectronError([{ path: 'backup', message: 'backupRecoveryRequired' }])
      }
      const originals = Object.fromEntries(
        await Promise.all(
          persistenceSections.map(async (section) => [
            section,
            await read(path.join(base, `${section}.json`)),
          ]),
        ),
      )
      const prepared = persistenceSections.map((section) => {
        const text = JSON.stringify(records[section])
        if (text === undefined)
          throw new ElectronError([{ path: 'backup', message: 'backupInvalid' }])
        return { section, text }
      })
      let committed = false
      try {
        await write(journal, JSON.stringify({ version: 1, records: originals }))
        await syncDirectory(base)
        for (const { section, text } of prepared)
          await write(path.join(base, `${section}.json`), text)
        await syncDirectory(base)
        await unlink(journal)
        committed = true
        await syncDirectory(base)
        await cleanup(base)
      } catch {
        if (committed)
          throw new ElectronError([{ path: 'backup', message: 'backupRecoveryRequired' }])
        try {
          await recover()
        } catch {
          throw new ElectronError([{ path: 'backup', message: 'backupRecoveryRequired' }])
        }
        throw new ElectronError([{ path: 'backup', message: 'backupRestoreFailed' }])
      }
    },
  }
}
