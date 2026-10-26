import gt from 'semver/functions/gt.js'
import type { NpmPlugin, PluginBridge } from '../../shared/plugins.ts'
import type { PluginEntry } from './registry.ts'

export async function checkPluginUpdates(bridge: Pick<PluginBridge, 'latest'>, installed: readonly PluginEntry[], failed: (name: string) => void) {
  const updates: NpmPlugin[] = []
  for (const entry of installed) {
    try {
      const result = await bridge.latest(entry.id)
      if ('issues' in result || result.value.name !== entry.id || result.value.nesso.kind !== entry.kind) { failed(entry.id); continue }
      if (gt(result.value.version, entry.version)) updates.push(result.value)
    } catch { failed(entry.id) }
  }
  return updates
}
