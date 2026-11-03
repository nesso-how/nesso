import { PluginError } from './errors.ts'

export function checkMessageSize(value: unknown, limit: number, maximumDepth = 32): void {
  const exceeded = () =>
    new PluginError('invalid-input', [{ path: 'message', message: 'Message limit exceeded' }])
  let size = 0
  const visit = (value: unknown, depth: number): void => {
    if (depth > maximumDepth)
      throw new PluginError('invalid-input', [
        { path: 'message', message: 'Nesting limit exceeded' },
      ])
    if (value === undefined) return
    size += typeof value === 'string' ? value.length + 1 : 1
    if (size > limit) throw exceeded()
    if (value === null) return
    if (typeof value === 'object') {
      const array = Array.isArray(value)
      if (!array && Object.getPrototypeOf(value) !== Object.prototype)
        throw new PluginError('invalid-input', [
          { path: 'message', message: 'Expected plain data' },
        ])
      for (const [key, item] of Object.entries(value)) {
        if (!array && item !== undefined) size += key.length
        visit(item, depth + 1)
      }
    } else if (
      !['string', 'number', 'boolean'].includes(typeof value) ||
      (typeof value === 'number' && !Number.isFinite(value))
    ) {
      throw new PluginError('invalid-input', [
        { path: 'message', message: 'Expected serializable data' },
      ])
    }
  }
  visit(value, 0)
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > limit) throw exceeded()
}
