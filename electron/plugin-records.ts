import { z } from 'zod'
import { createHash } from 'node:crypto'
import {
  parsePackageIdentity,
  preparePluginPackage,
  verifyPluginPackage,
} from '@nesso-how/plugin/package'
import { parsePluginI18n, parsePluginManifest } from '@nesso-how/plugin/runtime'
import { npmIntegrity, type InstalledPlugin } from '../shared/plugins.ts'
import { ElectronError } from './errors.ts'

const identity = {
  name: z.string(),
  version: z.string(),
  author: z.string().optional(),
  repository: z.string().optional(),
  nesso: z.unknown(),
  i18n: z.unknown(),
  code: z.string().max(16 * 1024 * 1024),
  contentId: z.string().regex(/^[a-f0-9]{64}$/),
  enabled: z.boolean(),
  npmIntegrity: npmIntegrity.optional(),
}
const recordV1 = z.strictObject({
  ...identity,
  formatVersion: z.literal(1).optional(),
  fonts: z
    .array(
      z.strictObject({
        path: z
          .string()
          .max(240)
          .regex(/^(?:[\w-]+\/)*[\w-]+\.woff2$/),
        data: z.string().max(Math.ceil((4 * 1024 * 1024) / 3) * 4),
      }),
    )
    .max(32),
})
const recordV2 = z.strictObject({ ...identity, formatVersion: z.literal(2) })
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`
  return JSON.stringify(value)
}
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
const fail = (): never => {
  throw new ElectronError([
    { path: 'plugins', message: 'Invalid or unsupported installed package record' },
  ])
}

export function serializePluginRecord(record: InstalledPlugin): string {
  return JSON.stringify({ formatVersion: 2, ...record })
}

const legacyFiles = (saved: z.infer<typeof recordV1>, entry: string, kind: string) => {
  const bytes = Buffer.from(saved.code, 'utf8')
  if (!bytes.length || bytes.byteLength > 16 * 1024 * 1024) return fail()
  const files = [{ path: entry, size: bytes.byteLength, sha256: hash(bytes) }]
  const paths = new Set([entry])
  for (const font of saved.fonts) {
    if (kind !== 'theme' || paths.has(font.path)) return fail()
    paths.add(font.path)
    let content: Uint8Array
    try {
      content = Uint8Array.from(atob(font.data), (character) => character.charCodeAt(0))
    } catch {
      return fail()
    }
    if (
      !content.length ||
      content.length > 4 * 1024 * 1024 ||
      Buffer.from(content.subarray(0, 4)).toString() !== 'wOF2'
    )
      return fail()
    files.push({ path: font.path, size: content.byteLength, sha256: hash(content) })
  }
  return files.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
}

export async function migratePluginRecord(value: unknown): Promise<InstalledPlugin> {
  const envelope = z
    .object({ formatVersion: z.number().int().positive().optional() })
    .safeParse(value)
  if (!envelope.success) return fail()
  switch (envelope.data.formatVersion ?? 1) {
    case 1: {
      const parsed = recordV1.safeParse(value)
      if (!parsed.success) return fail()
      const saved = parsed.data
      const declaration = z.object({ apiVersion: z.literal(2) }).safeParse(saved.nesso)
      if (!declaration.success) return fail()
      const { name, version, author, repository } = parsePackageIdentity(saved)
      const nesso = parsePluginManifest({ ...(saved.nesso as object), apiVersion: 3 })
      const i18n = parsePluginI18n(saved.i18n)
      const index = {
        name,
        version,
        author,
        repository,
        nesso: { ...nesso, apiVersion: 2 },
        i18n,
        files: legacyFiles(saved, nesso.entry, nesso.kind),
      }
      if (hash(canonical(index)) !== saved.contentId) return fail()
      let code = saved.code
      if (nesso.kind === 'theme') {
        const definition = z
          .strictObject({
            id: z.unknown(),
            colors: z.unknown(),
            metrics: z.unknown(),
            fonts: z.unknown(),
          })
          .safeParse(JSON.parse(code))
        if (!definition.success || !('fonts' in definition.data)) return fail()
        const { id, colors, metrics } = definition.data
        code = JSON.stringify({ id, colors, metrics })
      }
      const prepared = await preparePluginPackage({
        manifest: { name, version, author, repository, nesso, i18n },
        files: [{ path: nesso.entry, bytes: Buffer.from(code, 'utf8') }],
      })
      return {
        ...prepared,
        enabled: saved.enabled,
        ...(saved.npmIntegrity ? { npmIntegrity: saved.npmIntegrity } : {}),
      }
    }
    case 2: {
      const parsed = recordV2.safeParse(value)
      if (!parsed.success) return fail()
      const saved = parsed.data
      const prepared = await verifyPluginPackage({
        ...saved,
        nesso: parsePluginManifest(saved.nesso),
        i18n: parsePluginI18n(saved.i18n),
      })
      return {
        ...prepared,
        enabled: saved.enabled,
        ...(saved.npmIntegrity ? { npmIntegrity: saved.npmIntegrity } : {}),
      }
    }
    default:
      return fail()
  }
}
