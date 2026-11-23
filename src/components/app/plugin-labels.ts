import type { PluginEntry } from '@/plugins/registry'

export const pluginKindLabels = {
  actions: 'actions',
  theme: 'pluginThemes',
  vocab: 'pluginVocabularies',
} as const satisfies Record<PluginEntry['kind'], string>

export function pluginStatusLabel(entry: PluginEntry) {
  if (entry.incompatible) return 'pluginIncompatible'
  if (entry.disabled) return 'pluginDisabled'
  if (entry.error) return 'pluginUnavailable'
  return 'pluginEnabled'
}
