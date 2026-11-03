import { PluginError } from '@nesso-how/plugin/runtime'

export function createPluginEntry(asset: string | Uint8Array) {
  const entry = typeof asset === 'string' ? asset : new Uint8Array(asset)
  let source: string | undefined
  return async (signal: AbortSignal) => {
    signal.throwIfAborted()
    if (source !== undefined) return source
    let bytes: Uint8Array
    if (typeof entry === 'string') {
      const response = await fetch(entry, { signal })
      if (!response.ok)
        throw new PluginError('failed', [
          { path: 'package', message: 'Could not load bundled plugin assets' },
        ])
      bytes = new Uint8Array(await response.arrayBuffer())
    } else bytes = entry
    signal.throwIfAborted()
    if (bytes.byteLength > 16 * 1024 * 1024)
      throw new PluginError('invalid-input', [
        { path: 'package', message: 'Plugin asset limit exceeded' },
      ])
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 32768)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
    source = `data:text/javascript;base64,${btoa(binary)}`
    return source
  }
}
