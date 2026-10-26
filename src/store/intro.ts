import type { Locale } from '@nesso-how/i18n'
import type { NessoStore } from '@nesso-how/plugin'
import { createSeedDocument } from '../data/seed.ts'
import { createNessoStore } from './create.ts'
import type { HostOperation, HostStore } from './types.ts'

const conceptViewId = 'intro-concept'
export const focusConceptId = 'urn:nesso:example:focus'

export function completeIntro(store: HostStore) {
  const { graph, preferences } = store.getState()
  const operations: HostOperation[] = [{ kind: 'preferences.intro-seen' }]
  if (!preferences.introSeen && graph.concepts.some(({ id }) => id === focusConceptId)) {
    operations.push({ kind: 'selection.set', value: [{ kind: 'concept', id: focusConceptId }] })
  }
  store.applyOperations(operations)
}

export function setIntroStep(store: NessoStore, step: number) {
  const { graph, workspace } = store.getState()
  const hasConceptView = workspace.savedViews.some(({ id }) => id === conceptViewId)
  store.applyOperations([
    ...(step === 0 && !hasConceptView
      ? [{ kind: 'view.create' as const, id: conceptViewId, name: graph.concepts[0].label, conceptIds: [graph.concepts[0].id] }]
      : []),
    { kind: 'view.activate', id: step === 0 ? conceptViewId : null },
    ...(step > 0 && hasConceptView
      ? [{ kind: 'view.remove' as const, id: conceptViewId }]
      : []),
    { kind: 'selection.set', value: step === 0 || step === 2 ? [{ kind: 'concept', id: step === 0 ? graph.concepts[0].id : focusConceptId }] : [] },
  ])
}

export function createIntroStore(locale: Locale) {
  const seed = createSeedDocument(locale)
  const { store } = createNessoStore(seed.graph, { workspace: seed.workspace })
  store.setLocale(locale)
  setIntroStep(store, 0)
  return store
}
