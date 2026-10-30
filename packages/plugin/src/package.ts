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
  font: 4 * 1024 * 1024,
  fonts: 32,
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
  readonly fonts: readonly { readonly path: string; readonly data: string }[]
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
  if (
    !Array.isArray(input.files) ||
    !input.files.length ||
    input.files.length > (nesso.kind === 'theme' ? packageLimits.fonts + 1 : 1)
  )
    throw new PluginError('invalid-input', [
      { path: 'files', message: 'Expected one entry and supported local theme fonts only' },
    ])
  const paths = new Set<string>()
  const fonts: { path: string; data: string }[] = []
  const files: { path: string; size: number; sha256: string }[] = []
  let bytes: Uint8Array | undefined
  let admitted = 0
  for (const file of input.files) {
    if (
      !file ||
      typeof file.path !== 'string' ||
      file.path.length > 240 ||
      paths.has(file.path) ||
      !(file.bytes instanceof Uint8Array) ||
      !file.bytes.byteLength ||
      file.bytes.byteLength > (file.path === nesso.entry ? packageLimits.entry : packageLimits.font)
    )
      throw new PluginError('invalid-input', [
        { path: 'files', message: 'Invalid, duplicate, or oversized package file' },
      ])
    paths.add(file.path)
    admitted +=
      file.path === nesso.entry ? file.bytes.byteLength : Math.ceil(file.bytes.byteLength / 3) * 4
    if (admitted > packageLimits.record)
      throw new PluginError('invalid-input', [
        { path: 'files', message: 'Package record budget exceeded' },
      ])
    const content = new Uint8Array(file.bytes)
    if (file.path === nesso.entry) bytes = content
    else {
      if (
        nesso.kind !== 'theme' ||
        !/^(?:[\w-]+\/)*[\w-]+\.woff2$/.test(file.path) ||
        new TextDecoder().decode(content.subarray(0, 4)) !== 'wOF2'
      )
        throw new PluginError('invalid-input', [
          { path: file.path, message: 'Expected a package-local WOFF2 font' },
        ])
      let binary = ''
      for (let offset = 0; offset < content.length; offset += 32_768)
        binary += String.fromCharCode(...content.subarray(offset, offset + 32_768))
      fonts.push({ path: file.path, data: btoa(binary) })
    }
    files.push({ path: file.path, size: content.byteLength, sha256: await sha256Hex(content) })
  }
  if (!bytes)
    throw new PluginError('invalid-input', [
      { path: 'nesso.entry', message: 'Missing plugin entry' },
    ])
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
  const order = (left: { path: string }, right: { path: string }) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  const index = { name, version, author, repository, nesso, i18n, files: files.sort(order) }
  const prepared = {
    name,
    version,
    author,
    repository,
    nesso,
    i18n,
    code,
    fonts: fonts.sort(order),
    contentId: await sha256Hex(new TextEncoder().encode(canonical(index))),
  }
  if (new TextEncoder().encode(JSON.stringify(prepared)).byteLength > packageLimits.record)
    throw new PluginError('invalid-input', [
      { path: 'files', message: 'Package record budget exceeded' },
    ])
  return prepared
}

export function packageFonts(value: PreparedPlugin): ReadonlyMap<string, Uint8Array> {
  if (!Array.isArray(value.fonts) || value.fonts.length > packageLimits.fonts)
    throw new PluginError('invalid-input', [
      { path: 'fonts', message: 'Invalid installed font assets' },
    ])
  return new Map(
    value.fonts.map((font) => {
      if (
        !font ||
        typeof font.path !== 'string' ||
        typeof font.data !== 'string' ||
        font.data.length > Math.ceil(packageLimits.font / 3) * 4
      )
        throw new PluginError('invalid-input', [
          { path: 'fonts', message: 'Invalid font encoding or budget' },
        ])
      try {
        return [font.path, Uint8Array.from(atob(font.data), (character) => character.charCodeAt(0))]
      } catch {
        throw new PluginError('invalid-input', [
          { path: 'fonts', message: 'Invalid font encoding' },
        ])
      }
    }),
  )
}

export async function verifyPluginPackage(value: PreparedPlugin): Promise<PreparedPlugin> {
  if (!value || typeof value.code !== 'string' || value.code.length > packageLimits.entry)
    throw new PluginError('invalid-input', [
      { path: 'package', message: 'Invalid installed plugin package' },
    ])
  const fonts = packageFonts(value)
  if (fonts.size !== value.fonts.length)
    throw new PluginError('invalid-input', [{ path: 'fonts', message: 'Duplicate font assets' }])
  const prepared = await preparePluginPackage({
    manifest: {
      name: value.name,
      version: value.version,
      author: value.author,
      repository: value.repository,
      nesso: value.nesso,
      i18n: value.i18n,
    },
    files: [
      { path: value.nesso?.entry, bytes: new TextEncoder().encode(value.code) },
      ...[...fonts].map(([path, bytes]) => ({ path, bytes })),
    ],
  })
  if (prepared.contentId !== value.contentId)
    throw new PluginError('denied', [
      { path: 'contentId', message: 'Package content does not match its approval' },
    ])
  return prepared
}
