import { z } from 'zod'
import parseVersion from 'semver/functions/parse.js'
import validateName from 'validate-npm-package-name'
import {
  checkMessageSize,
  parseDefinition,
  parsePluginI18n,
  parsePluginManifest,
  parseOrThrow,
  PluginError,
  sha256Hex,
  type PluginI18n,
  type PluginManifest,
} from './runtime.ts'

export const packageLimits = {
  entry: 16 * 1024 * 1024,
  record: 32 * 1024 * 1024,
  installed: 32,
  total: 128 * 1024 * 1024,
} as const
export type PluginPackageInput = {
  readonly manifest: unknown
  readonly files: readonly { readonly path: string; readonly bytes: Uint8Array }[]
}
export type PreparedPlugin = {
  readonly name: string
  readonly version: string
  readonly author?: string
  readonly repository?: string
  readonly nesso: PluginManifest
  readonly i18n: PluginI18n
  readonly code: string
  readonly contentId: string
}

const author = z
  .union([z.string().max(512), z.object({ name: z.string().max(128) })])
  .transform((value) => (typeof value === 'string' ? value : value.name).split(/[<(]/)[0].trim())
  .pipe(
    z
      .string()
      .min(1)
      .max(128)
      .regex(/^\P{Cc}+$/u),
  )
  .optional()
  .catch(undefined)
const repository = z
  .union([z.string().max(2048), z.object({ url: z.string().max(2048) })])
  .transform((value) => {
    const source = typeof value === 'string' ? value : value.url
    if (/[\p{Cc}\s\\]/u.test(source)) return undefined
    try {
      const url = new URL(source.replace(/^git\+/, '').replace(/^github:/, 'https://github.com/'))
      const pathname = url.pathname.replace(/\/$/, '').replace(/\.git$/, '')
      if (
        url.origin !== 'https://github.com' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !/^\/[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9._-]+$/.test(pathname)
      )
        return undefined
      return `${url.origin}${pathname}`
    } catch {
      return undefined
    }
  })
  .optional()
  .catch(undefined)
const identity = z.object({
  name: z
    .string()
    .max(214)
    .refine(
      (value) => validateName(value).validForNewPackages,
      'Expected a valid npm package name',
    ),
  version: z
    .string()
    .max(128)
    .refine((value) => {
      const parsed = parseVersion(value)
      return (
        parsed !== null &&
        `${parsed.version}${parsed.build.length ? `+${parsed.build.join('.')}` : ''}` === value
      )
    }, 'Expected an exact semantic version'),
  author,
  repository,
  nesso: z.unknown().optional(),
  i18n: z.unknown().optional(),
})
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
export function parsePackageIdentity(value: unknown) {
  return parseOrThrow(identity, value)
}

export async function preparePluginPackage(input: PluginPackageInput): Promise<PreparedPlugin> {
  checkMessageSize(input.manifest, 64 * 1024)
  const {
    name,
    version,
    author,
    repository,
    nesso: declaration,
    i18n: translations,
  } = parsePackageIdentity(input.manifest)
  const nesso = parsePluginManifest(declaration)
  const i18n = parsePluginI18n(translations)
  if (!Array.isArray(input.files) || input.files.length !== 1)
    throw new PluginError('invalid-input', [
      { path: 'files', message: 'Expected one plugin entry only' },
    ])
  const file = input.files[0]
  if (
    !file ||
    file.path !== nesso.entry ||
    !(file.bytes instanceof Uint8Array) ||
    !file.bytes.byteLength ||
    file.bytes.byteLength > packageLimits.entry
  )
    throw new PluginError('invalid-input', [
      { path: 'files', message: 'Expected the plugin entry within size limits' },
    ])
  const bytes = new Uint8Array(file.bytes)
  const files = [{ path: file.path, size: bytes.byteLength, sha256: await sha256Hex(bytes) }]
  let code: string
  try {
    code = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    throw new PluginError('invalid-input', [
      { path: 'files', message: 'Expected UTF-8 entry text' },
    ])
  }
  if (nesso.kind !== 'actions') {
    let raw: unknown
    try {
      raw = JSON.parse(code)
    } catch {
      throw new PluginError('invalid-input', [
        { path: nesso.entry, message: 'Expected a JSON definition' },
      ])
    }
    parseDefinition(nesso.kind, raw)
  }
  const index = { name, version, author, repository, nesso, i18n, files }
  const prepared = {
    name,
    version,
    author,
    repository,
    nesso,
    i18n,
    code,
    contentId: await sha256Hex(new TextEncoder().encode(canonical(index))),
  }
  if (new TextEncoder().encode(JSON.stringify(prepared)).byteLength > packageLimits.record)
    throw new PluginError('invalid-input', [
      { path: 'files', message: 'Package record budget exceeded' },
    ])
  return prepared
}

export async function verifyPluginPackage(value: PreparedPlugin): Promise<PreparedPlugin> {
  if (!value || typeof value.code !== 'string' || value.code.length > packageLimits.entry)
    throw new PluginError('invalid-input', [
      { path: 'package', message: 'Invalid installed plugin package' },
    ])
  const prepared = await preparePluginPackage({
    manifest: {
      name: value.name,
      version: value.version,
      author: value.author,
      repository: value.repository,
      nesso: value.nesso,
      i18n: value.i18n,
    },
    files: [{ path: value.nesso?.entry, bytes: new TextEncoder().encode(value.code) }],
  })
  if (prepared.contentId !== value.contentId)
    throw new PluginError('denied', [
      { path: 'contentId', message: 'Package content does not match its approval' },
    ])
  return prepared
}
