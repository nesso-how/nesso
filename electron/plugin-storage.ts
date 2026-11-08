import { constants } from 'node:fs'
import { mkdir, open, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { packageLimits, verifyPluginPackage, type PreparedPlugin } from '@nesso-how/plugin/package'
import { npmIntegrity, type InstalledPlugin } from '../shared/plugins.ts'
import { ElectronError } from './errors.ts'
import { saveChosenFile } from './file-access.ts'
import { migratePluginRecord, serializePluginRecord } from './plugin-records.ts'

async function preserveOriginal(filename: string, bytes: Buffer) {
  const original = `${filename}.${createHash('sha256').update(bytes).digest('hex')}.v1.bak`
  try {
    const backup = await open(original, 'wx', 0o600)
    try {
      await backup.writeFile(bytes)
      await backup.sync()
    } finally {
      await backup.close()
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    const backup = await open(
      original,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    )
    try {
      const stat = await backup.stat()
      if (
        !stat.isFile() ||
        stat.size !== bytes.byteLength ||
        !(await backup.readFile()).equals(bytes)
      )
        throw new ElectronError([
          { path: 'plugins', message: 'Could not preserve original installed package record' },
        ])
    } finally {
      await backup.close()
    }
  }
}

export function createPluginStorage(directory: string) {
  let queue = Promise.resolve()
  const fail = (message: string): never => {
    throw new ElectronError([{ path: 'plugins', message }])
  }
  const origin = (value: unknown) => {
    if (value === undefined) return {}
    const parsed = npmIntegrity.safeParse(value)
    if (!parsed.success) return fail('Invalid npm provenance')
    return { npmIntegrity: parsed.data }
  }
  const filename = (name: string) =>
    path.join(directory, `${createHash('sha256').update(name).digest('hex')}.json`)
  const scan = async (strict = true) => {
    const entries = await readdir(directory, { withFileTypes: true }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return []
        throw error
      },
    )
    const records = entries.filter(({ name }) => name.endsWith('.json'))
    if (records.length > packageLimits.installed) fail('Installed package budget exceeded')
    const installed: InstalledPlugin[] = []
    const issues: { path: string; message: string }[] = []
    const sizes = new Map<string, number>()
    let total = 0
    for (const entry of records) {
      try {
        if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/.test(entry.name))
          fail('Invalid installed package record')
        const file = await open(
          path.join(directory, entry.name),
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        )
        let text: string
        let bytes: Buffer
        let size = 0
        try {
          const chunks: Uint8Array[] = []
          if (!(await file.stat()).isFile()) fail('Invalid installed package record')
          for await (const chunk of file.createReadStream({
            autoClose: false,
            end: packageLimits.record,
          })) {
            size += chunk.byteLength
            total += chunk.byteLength
            if (size > packageLimits.record || total > packageLimits.total)
              fail('Installed package budget exceeded')
            chunks.push(chunk)
          }
          bytes = Buffer.concat(chunks, size)
          text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        } finally {
          await file.close()
        }
        const record = JSON.parse(text)
        const prepared = await migratePluginRecord(record)
        if (
          typeof record.enabled !== 'boolean' ||
          entry.name !== path.basename(filename(prepared.name)) ||
          installed.some(({ name }) => name === prepared.name)
        )
          fail('Invalid installed package record')
        if (record.formatVersion === undefined || record.formatVersion === 1) {
          await preserveOriginal(path.join(directory, entry.name), bytes)
          const upgraded = serializePluginRecord(prepared)
          const upgradedSize = Buffer.byteLength(upgraded)
          if (
            upgradedSize > packageLimits.record ||
            total - size + upgradedSize > packageLimits.total
          )
            fail('Installed package budget exceeded')
          await saveChosenFile(
            path.join(directory, entry.name),
            { name: 'package.json', mediaType: 'application/json', text: upgraded },
            () => true,
          )
          total += upgradedSize - size
          size = upgradedSize
        }
        installed.push(prepared)
        sizes.set(prepared.name, size)
      } catch (error) {
        if (strict || total > packageLimits.total) throw error
        issues.push({ path: entry.name, message: 'Could not read installed package record' })
      }
    }
    return { installed, total, sizes, issues }
  }
  const change = <T>(run: () => Promise<T>) => {
    const result = queue.then(run)
    queue = result.then(
      () => {},
      () => {},
    )
    return result
  }
  const check = async (
    prepared: PreparedPlugin & Pick<InstalledPlugin, 'npmIntegrity'>,
    replacing?: string,
  ) => {
    if (
      [
        '@nesso-how/kernel-theme',
        '@nesso-how/paper-theme',
        '@nesso-how/mist-theme',
        '@nesso-how/base-vocab',
        '@nesso-how/import',
        '@nesso-how/export',
        '@nesso-how/review',
        '@nesso-how/notes',
      ].includes(prepared.name)
    )
      fail('Bundled package identities are reserved')
    let scanned: Awaited<ReturnType<typeof scan>>
    try {
      scanned = await scan()
    } catch (error) {
      const relaxed = await scan(false)
      const stale = path.basename(filename(prepared.name))
      if (!relaxed.issues.length || !relaxed.issues.every(({ path }) => path === stale)) throw error
      scanned = relaxed
    }
    const { installed, total, sizes } = scanned
    const previous = installed.find(({ name }) => name === prepared.name)
    if (
      replacing === undefined
        ? previous
        : !previous || previous.contentId !== replacing || previous.contentId === prepared.contentId
    )
      fail('Package identity changed or is already installed')
    if (previous && !previous.npmIntegrity !== !prepared.npmIntegrity)
      fail('Package provenance changed')
    const record: InstalledPlugin = {
      ...prepared,
      ...origin(prepared.npmIntegrity),
      enabled: previous?.enabled ?? true,
    }
    const text = serializePluginRecord(record)
    const size = new TextEncoder().encode(text).byteLength
    const previousSize = sizes.get(prepared.name) ?? 0
    if (
      (!previous && installed.length >= packageLimits.installed) ||
      size > packageLimits.record ||
      total - previousSize + size > packageLimits.total
    )
      fail('Installed package budget exceeded')
    return { record, text }
  }
  const find = async (contentId: string) => {
    const { installed, total, sizes } = await scan()
    const record = installed.find((entry) => entry.contentId === contentId)
    if (!record) return fail('Installed package identity changed')
    return { record, remaining: total - (sizes.get(record.name) ?? 0) }
  }
  const save = async (record: InstalledPlugin, text: string, current: () => boolean) => {
    if (!current()) fail('Installation cancelled')
    await mkdir(directory, { recursive: true })
    const saved = await saveChosenFile(
      filename(record.name),
      { name: 'package.json', mediaType: 'application/json', text },
      current,
    )
    if (!saved.saved) fail('Installation cancelled')
    return record
  }
  return {
    list: () =>
      change(async () => {
        const { installed, issues } = await scan(false)
        return { packages: installed, issues }
      }),
    check: (prepared: PreparedPlugin & Pick<InstalledPlugin, 'npmIntegrity'>, replacing?: string) =>
      change(async () => (await check(prepared, replacing)).record),
    install: (
      input: PreparedPlugin & Pick<InstalledPlugin, 'npmIntegrity'>,
      current: () => boolean,
      replacing?: string,
    ) =>
      change(async () => {
        const prepared = await verifyPluginPackage(input)
        const { record, text } = await check(
          { ...prepared, ...origin(input.npmIntegrity) },
          replacing,
        )
        return save(record, text, current)
      }),
    setEnabled: (contentId: string, enabled: boolean) =>
      change(async () => {
        const previous = await find(contentId)
        const record = { ...previous.record, enabled }
        const text = serializePluginRecord(record)
        const size = new TextEncoder().encode(text).byteLength
        if (size > packageLimits.record || previous.remaining + size > packageLimits.total)
          fail('Installed package budget exceeded')
        return save(record, text, () => true)
      }),
    remove: (contentId: string) =>
      change(async () => {
        const { record } = await find(contentId)
        await rm(filename(record.name))
      }),
  }
}
