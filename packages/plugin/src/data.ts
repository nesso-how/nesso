import { PluginError } from './errors.ts'

export function checkMessageSize(value: unknown, limit: number, maximumDepth = 32): void {
  const visit = (value: unknown, depth: number): void => {
    if (depth > maximumDepth) throw new PluginError('invalid-input', [{ path: 'message', message: 'Nesting limit exceeded' }])
    if (value === null) return
    if (typeof value === 'object') {
      if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) throw new PluginError('invalid-input', [{ path: 'message', message: 'Expected plain data' }])
      for (const item of Object.values(value)) visit(item, depth + 1)
    } else if (!['string', 'number', 'boolean', 'undefined'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value)) {
      throw new PluginError('invalid-input', [{ path: 'message', message: 'Expected serializable data' }])
    }
  }
  visit(value, 0)
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > limit) throw new PluginError('invalid-input', [{ path: 'message', message: 'Message limit exceeded' }])
}
