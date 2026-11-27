import type { Preferences } from '@nesso-how/core'
import { isLocale } from '@nesso-how/i18n'
import type { ThemeDefinition } from '@nesso-how/plugin'
import { SchemaError } from '@nesso-how/schema'
import { fail } from './settings.ts'
import { sectionIds, type HostOperation, type HostState, type RendererDefinition } from './types.ts'

type PreferenceOperation = Extract<HostOperation, { kind: `preferences.${string}` }>

export type OperationRegistry = {
  readonly renderers: ReadonlyMap<string, RendererDefinition>
  readonly themes: ReadonlyMap<string, ThemeDefinition>
}

export function applyPreferenceOperation(
  preferences: Preferences,
  operation: PreferenceOperation,
  vocabs: HostState['vocabs'],
  registry: OperationRegistry,
): Preferences {
  switch (operation.kind) {
    case 'preferences.vocab':
      if (!vocabs.some((vocab) => vocab.id === operation.id)) {
        throw new SchemaError([
          { path: 'activeVocabId', message: `Unknown vocabulary: ${operation.id}` },
        ])
      }
      return { ...preferences, activeVocabId: operation.id }
    case 'preferences.renderer':
      if (!registry.renderers.has(operation.id)) {
        throw new SchemaError([
          { path: 'activeRendererId', message: `Unknown renderer: ${operation.id}` },
        ])
      }
      return { ...preferences, activeRendererId: operation.id }
    case 'preferences.theme':
      if (!registry.themes.has(operation.id))
        fail('preferences.activeThemeId', `Unknown theme: ${operation.id}`)
      return { ...preferences, activeThemeId: operation.id }
    case 'preferences.locale':
      if (!isLocale(operation.value)) fail('preferences.locale', 'Unsupported locale')
      return { ...preferences, locale: operation.value }
    case 'preferences.intro-seen':
      return { ...preferences, introSeen: true }
    case 'preferences.mcpEnabled':
      if (typeof operation.value !== 'boolean') fail('preferences.mcpEnabled', 'Expected a boolean')
      return { ...preferences, mcpEnabled: operation.value }
    case 'preferences.panels':
      return { ...preferences, panels: { ...operation.value } }
    case 'preferences.disabledBundledActionPlugins':
      if (!Array.isArray(operation.value))
        fail('preferences.disabledBundledActionPlugins', 'Expected an array')
      return { ...preferences, disabledBundledActionPlugins: [...operation.value] }
    case 'preferences.canvasTabOrder.append': {
      if (!Array.isArray(operation.ids)) fail('preferences.canvasTabOrder', 'Expected an array')
      const order = preferences.canvasTabOrder ?? []
      const unseen = [...new Set(operation.ids)].filter((id) => !order.includes(id))
      return unseen.length ? { ...preferences, canvasTabOrder: [...order, ...unseen] } : preferences
    }
    case 'preferences.inspectorTab':
      return { ...preferences, inspectorTab: operation.value }
    case 'preferences.appearance':
      return { ...preferences, appearance: operation.value }
    case 'preferences.relationGroups':
      return { ...preferences, relationGroups: operation.value }
    case 'preferences.section': {
      if (!sectionIds.includes(operation.id))
        fail('preferences.collapsedSections', 'Unknown section')
      if (typeof operation.open !== 'boolean') fail('section.open', 'Expected a boolean')
      const collapsed = preferences.collapsedSections ?? []
      if (collapsed.includes(operation.id) !== operation.open) return preferences
      return {
        ...preferences,
        collapsedSections: operation.open
          ? collapsed.filter((id) => id !== operation.id)
          : [...collapsed, operation.id],
      }
    }
    default:
      operation satisfies never
      throw new SchemaError([{ path: 'operations', message: 'Unknown operation' }])
  }
}
