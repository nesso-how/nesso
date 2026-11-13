import gt from 'semver/functions/gt.js'
import type { NpmPlugin, PluginBridge } from '../../shared/plugins.ts'
import type { PluginEntry } from './registry.ts'

export async function checkPluginUpdates(
  bridge: Pick<PluginBridge, 'latest'>,
  installed: readonly PluginEntry[],
  failed: (name: string) => void,
) {
  const updates: NpmPlugin[] = []
  for (const entry of installed) {
    try {
      const result = await bridge.latest(entry.id)
      const latest = 'value' in result ? result.value : undefined
      if (latest === null) continue
      if (!latest || latest.name !== entry.id || latest.nesso.kind !== entry.kind) {
        failed(entry.id)
        continue
      }
      if (gt(latest.version, entry.version)) updates.push(latest)
    } catch {
      failed(entry.id)
    }
  }
  return updates
}
