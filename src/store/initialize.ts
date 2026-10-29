import { detectLocale } from '@nesso-how/i18n'
import { createSeedDocument } from '../data/seed.ts'
import { createNessoStore } from './create.ts'
import type { LoadedState } from './persistence.ts'
import { collectPluginStorageOrphans } from './plugin-storage.ts'

export function initializeNessoStore(loaded: LoadedState, languages: readonly string[]) {
  const locale = loaded.preferences?.locale ?? detectLocale(languages)
  const firstRun = loaded.graph === undefined && !loaded.blocked.includes('document')
  const seed = firstRun ? createSeedDocument(locale) : undefined
  const pluginStorage = loaded.graph && loaded.pluginStorage && !loaded.blocked.includes('document') && !loaded.blocked.includes('plugin-storage')
    ? collectPluginStorageOrphans(loaded.pluginStorage, new Set(loaded.graph.concepts.map(({ id }) => id)))
    : loaded.pluginStorage
  const restored = { ...loaded, pluginStorage }
  const host = createNessoStore(seed?.graph ?? loaded.graph ?? null, seed ? { ...restored, workspace: seed.workspace } : restored)
  host.store.setLocale(locale)
  host.setPersistenceIssues(loaded.issues)
  return host
}
