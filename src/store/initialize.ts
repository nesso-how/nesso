import { detectLocale } from '@nesso/i18n'
import { createSeedDocument } from '../data/seed.ts'
import { createNessoStore } from './create.ts'
import type { LoadedState } from './persistence.ts'

export function initializeNessoStore(loaded: LoadedState, languages: readonly string[]) {
  const locale = loaded.preferences?.locale ?? detectLocale(languages)
  const firstRun = loaded.graph === undefined && !loaded.blocked.includes('document')
  const seed = firstRun ? createSeedDocument(locale) : undefined
  const host = createNessoStore(seed?.graph ?? loaded.graph ?? null, seed ? { ...loaded, workspace: seed.workspace } : loaded)
  host.store.setLocale(locale)
  host.setPersistenceIssues(loaded.issues)
  return host
}
