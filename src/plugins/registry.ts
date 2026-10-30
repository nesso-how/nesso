import type { ThemeDefinition, VocabDefinition } from '@nesso-how/plugin'
import { PluginError, type ActionDescriptor, type PluginI18n } from '@nesso-how/plugin/runtime'
import type { PluginAccess } from '../../shared/plugins.ts'

export type PluginEntry = {
  readonly id: string
  readonly version: string
  readonly author?: string
  readonly repository?: string
  readonly contentId?: string
  readonly npmIntegrity?: string
  readonly error?: string
  readonly disabled?: boolean
  readonly access?: PluginAccess
  readonly i18n: PluginI18n
} & (
  | { readonly kind: 'theme'; readonly contribution?: ThemeDefinition }
  | { readonly kind: 'vocab'; readonly contribution?: VocabDefinition }
  | { readonly kind: 'actions'; readonly contribution: readonly ActionDescriptor[] }
)

export function createPluginRegistry() {
  let entries: readonly PluginEntry[] = []
  let externalAvailable = false
  const listeners = new Set<() => void>()
  const check = (next: readonly PluginEntry[]) => {
    const packages = new Set<string>()
    const contributions = new Set<string>()
    for (const entry of next) {
      if (packages.has(entry.id))
        throw new PluginError('denied', [
          { path: 'registry', message: 'Duplicate package identity' },
        ])
      packages.add(entry.id)
      for (const contribution of entry.kind === 'actions'
        ? entry.contribution
        : entry.contribution
          ? [entry.contribution]
          : []) {
        const key = `${entry.kind}:${contribution.id}`
        if (contributions.has(key))
          throw new PluginError('denied', [
            { path: 'registry', message: 'Duplicate contribution identity' },
          ])
        contributions.add(key)
      }
    }
  }
  return {
    getSnapshot: () => entries,
    getExternalAvailable: () => externalAvailable,
    setExternalAvailable: (available: boolean) => {
      if (externalAvailable === available) return
      externalAvailable = available
      for (const listener of listeners) listener()
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    check,
    replace: (next: readonly PluginEntry[]) => {
      check(next)
      entries = structuredClone(next)
      for (const listener of listeners) listener()
    },
  }
}
