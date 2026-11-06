import { open, realpath } from 'node:fs/promises'
import path from 'node:path'
import {
  packageLimits,
  parsePackageIdentity,
  type PluginPackageInput,
} from '@nesso-how/plugin/package'
import { parseDefinition, parsePluginManifest, PluginError } from '@nesso-how/plugin/runtime'

const invalid = (at: string, message: string) =>
  new PluginError('invalid-input', [{ path: at, message }])

export async function readPluginDirectory(directory: string): Promise<PluginPackageInput> {
  if (!path.isAbsolute(directory))
    throw invalid('directory', 'Expected the absolute path of a package directory')
  const root = await realpath(directory).catch(() => {
    throw invalid('directory', 'Package directory not found')
  })
  const read = async (file: string, limit: number) => {
    const target = await realpath(path.join(root, file)).catch(() => {
      throw invalid(file, 'Package file not found')
    })
    const relative = path.relative(root, target)
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`))
      throw invalid(file, 'Expected a file inside the package directory')
    const handle = await open(target)
    try {
      const stats = await handle.stat()
      if (!stats.isFile() || stats.size > limit)
        throw invalid(file, 'Expected a package file within size limits')
      return new Uint8Array(await handle.readFile())
    } finally {
      await handle.close()
    }
  }
  const text = (bytes: Uint8Array, file: string) => {
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
    } catch {
      throw invalid(file, 'Expected JSON')
    }
  }
  const manifest = text(await read('package.json', 64 * 1024), 'package.json')
  const nesso = parsePluginManifest(parsePackageIdentity(manifest).nesso)
  const entry = await read(nesso.entry, packageLimits.entry)
  const fonts =
    nesso.kind === 'theme'
      ? new Set(
          Object.values(parseDefinition('theme', text(entry, nesso.entry)).fonts).flatMap(
            ({ faces }) => faces.map((face) => face.path),
          ),
        )
      : []
  const files = [{ path: nesso.entry, bytes: entry }]
  for (const font of fonts) files.push({ path: font, bytes: await read(font, packageLimits.font) })
  return { manifest, files }
}
