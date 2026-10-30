import { createHash, randomUUID } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { lstat, mkdir, open, readFile, readdir, realpath, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { DataLocationState } from '../shared/data-location.ts'
import { persistenceSections } from '../shared/persistence.ts'
import { ElectronError } from './errors.ts'

const marker = '.nesso-data-id'
const names = [...persistenceSections.map((section) => `${section}.json` as const), marker] as const
const fileSchema = z.strictObject({ name: z.enum(names), hash: z.string().regex(/^[0-9a-f]{64}$/) })
const configSchema = z.strictObject({
  directory: z.string(),
  identity: z.uuid(),
  transfer: z
    .strictObject({ source: z.string(), destination: z.string(), files: z.array(fileSchema) })
    .optional(),
})
type Config = z.infer<typeof configSchema>
const fail = (message: string): never => {
  throw new ElectronError([{ path: 'dataLocation', message }])
}
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT'
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')
const contains = (parent: string, child: string) => {
  const relative = path.relative(parent, child)
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  )
}
const syncDirectory = async (directory: string) => {
  if (process.platform === 'win32') return
  try {
    const handle = await open(directory, 'r')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EOPNOTSUPP'].includes((error as NodeJS.ErrnoException).code ?? ''))
      throw error
  }
}
const readFileData = async (file: string) => {
  try {
    if (!(await lstat(file)).isFile()) fail('storageSource')
  } catch (error) {
    if (missing(error)) return undefined
    throw error
  }
  return readFile(file)
}
const writeFileData = async (file: string, data: Buffer | string, exclusive = true) => {
  const handle = await open(file, exclusive ? 'wx' : 'w', 0o600)
  try {
    await handle.writeFile(data)
    await handle.sync()
  } finally {
    await handle.close()
  }
}

export async function createDataLocation(userData: string) {
  await mkdir(userData, { recursive: true })
  const defaultDirectory = await realpath(userData)
  const bootstrap = path.join(defaultDirectory, 'data-location.json')
  let config: Config
  let moving = false
  try {
    config = configSchema.parse(JSON.parse(await readFile(bootstrap, 'utf8')))
  } catch (error) {
    if (!missing(error)) fail('storageConfig')
    const identity = await readFileData(path.join(defaultDirectory, marker))
    const parsed = z.uuid().safeParse(identity?.toString() ?? randomUUID())
    if (!parsed.success) return fail('storageConfig')
    config = { directory: defaultDirectory, identity: parsed.data }
    if (!identity) {
      await writeFileData(path.join(defaultDirectory, marker), config.identity)
      await syncDirectory(defaultDirectory)
    }
  }
  const checkDirectory = async (directory: string, identity?: string) => {
    try {
      if (!path.isAbsolute(directory) || (await realpath(directory)) !== directory)
        fail('storageUnavailable')
      if (identity && (await readFileData(path.join(directory, marker)))?.toString() !== identity)
        fail('storageUnavailable')
    } catch {
      fail('storageUnavailable')
    }
  }
  await checkDirectory(config.directory, config.identity)
  const persist = async (next: Config) => {
    await writeFileData(`${bootstrap}.tmp`, JSON.stringify(next), false)
    await rename(`${bootstrap}.tmp`, bootstrap)
    config = next
    await syncDirectory(defaultDirectory)
  }
  const cleanup = async () => {
    const transfer = config.transfer
    if (!transfer) return
    const { source, destination, files } = transfer
    const committed = config.directory === destination
    if (
      !path.isAbsolute(source) ||
      !path.isAbsolute(destination) ||
      contains(source, destination) ||
      contains(destination, source) ||
      (config.directory !== source && !committed) ||
      (committed &&
        (files.at(-1)?.name !== marker || files.at(-1)?.hash !== digest(config.identity))) ||
      new Set(files.map(({ name }) => name)).size !== files.length
    )
      fail('storageConfig')
    await checkDirectory(source)
    await checkDirectory(destination)
    const originalIdentity = committed ? await readFileData(path.join(source, marker)) : undefined
    if (originalIdentity && originalIdentity.toString() !== config.identity) fail('storageCleanup')
    await syncDirectory(defaultDirectory)
    for (const { name, hash } of files) {
      const file = path.join(committed ? source : destination, name)
      const data = await readFileData(file)
      if (!data) continue
      if (digest(data) !== hash || (committed && !originalIdentity)) fail('storageCleanup')
      if (committed) {
        const active = await readFileData(path.join(destination, name))
        if (!active || digest(active) !== hash) fail('storageCleanup')
      }
      await unlink(file)
    }
    await syncDirectory(committed ? source : destination)
    await persist({ directory: config.directory, identity: config.identity })
  }
  if (config.transfer) {
    try {
      await cleanup()
    } catch {}
  }
  const state = (): DataLocationState => ({
    directory: config.directory,
    defaultDirectory,
    moving,
    cleanupPending: !!config.transfer,
  })
  const validate = async (directory: string) => {
    if (!path.isAbsolute(directory)) fail('storageDestination')
    let canonical: string
    try {
      canonical = await realpath(directory)
    } catch {
      return fail('storageUnavailable')
    }
    if (canonical === config.directory) return canonical
    if (contains(config.directory, canonical) || contains(canonical, config.directory))
      fail('storageNested')
    const entries = await readdir(canonical)
    if (
      canonical === defaultDirectory
        ? entries.some((name) => names.some((owned) => name === owned || name === `${owned}.tmp`))
        : entries.length > 0
    )
      fail('storageOccupied')
    return canonical
  }
  const move = async (directory: string) => {
    if (config.transfer) fail('storageCleanup')
    const destination = await validate(directory)
    if (destination === config.directory) return state()
    const source = config.directory
    await checkDirectory(source, config.identity)
    const data = new Map<(typeof names)[number], Buffer>()
    for (const name of names) {
      const bytes = await readFileData(path.join(source, name))
      if (bytes) data.set(name, bytes)
    }
    const transfer = { source, destination, files: [] as z.infer<typeof fileSchema>[] }
    try {
      await persist({ ...config, transfer })
      for (const [name, bytes] of data) {
        const target = path.join(destination, name)
        const handle = await open(target, 'wx', 0o600)
        try {
          transfer.files.push({ name, hash: digest(bytes) })
          await persist({ ...config, transfer })
          await handle.writeFile(bytes)
          await handle.sync()
        } finally {
          await handle.close()
        }
      }
      await syncDirectory(destination)
      await checkDirectory(source, config.identity)
      await checkDirectory(destination, config.identity)
      for (const { name, hash } of transfer.files) {
        const original = await readFileData(path.join(source, name))
        const copied = await readFileData(path.join(destination, name))
        if (!original || !copied || digest(original) !== hash || digest(copied) !== hash)
          fail('storageVerification')
      }
      await persist({ ...config, directory: destination })
    } catch (error) {
      if (config.directory === source) {
        try {
          await cleanup()
        } catch {}
        if (error instanceof ElectronError) throw error
        const code = (error as NodeJS.ErrnoException).code
        fail(
          code === 'ENOSPC'
            ? 'storageSpace'
            : code === 'EACCES' || code === 'EPERM' || code === 'EROFS'
              ? 'storageReadonly'
              : 'storageMoveFailure',
        )
      }
    }
    try {
      await cleanup()
    } catch {}
    return state()
  }
  return {
    state,
    validate,
    move,
    cleanup,
    setMoving: (value: boolean) => {
      moving = value
    },
    directory: () => {
      try {
        const file = path.join(config.directory, marker)
        if (
          realpathSync(config.directory) !== config.directory ||
          !lstatSync(file).isFile() ||
          readFileSync(file, 'utf8') !== config.identity
        )
          fail('storageUnavailable')
      } catch {
        fail('storageUnavailable')
      }
      return config.directory
    },
  }
}

export type DataLocation = Awaited<ReturnType<typeof createDataLocation>>
