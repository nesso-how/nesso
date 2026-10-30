import { constants } from 'node:fs'
import { mkdir, open, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import {
  packageLimits,
  verifyPluginPackage,
  type PreparedPlugin,
} from '../packages/plugin/src/package.ts'
import { npmIntegrity, type InstalledPlugin } from '../shared/plugins.ts'
import { ElectronError } from './errors.ts'
import { saveChosenFile } from './file-access.ts'

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
          text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size))
        } finally {
          await file.close()
        }
        const record = JSON.parse(text)
        const prepared = await verifyPluginPackage(record)
        if (
          typeof record.enabled !== 'boolean' ||
          entry.name !== path.basename(filename(prepared.name)) ||
          installed.some(({ name }) => name === prepared.name)
        )
          fail('Invalid installed package record')
        installed.push({ ...prepared, ...origin(record.npmIntegrity), enabled: record.enabled })
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
        '@nesso-how/base-vocab',
        '@nesso-how/import',
        '@nesso-how/export',
      ].includes(prepared.name)
    )
      fail('Bundled package identities are reserved')
    const { installed, total, sizes } = await scan()
    const previous = installed.find(({ name }) => name === prepared.name)
    if (
      replacing === undefined
        ? previous
        : !previous || previous.contentId !== replacing || previous.contentId === prepared.contentId
    )
      fail('Package identity changed or is already installed')
    const record: InstalledPlugin = {
      ...prepared,
      ...origin(prepared.npmIntegrity),
      enabled: previous?.enabled ?? true,
    }
    const text = JSON.stringify(record)
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
    list: async () => {
      await queue
      const { installed, issues } = await scan(false)
      return { packages: installed, issues }
    },
    check: async (
      prepared: PreparedPlugin & Pick<InstalledPlugin, 'npmIntegrity'>,
      replacing?: string,
    ) => {
      await queue
      return (await check(prepared, replacing)).record
    },
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
        const text = JSON.stringify(record)
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
