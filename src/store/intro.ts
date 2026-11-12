import { defaultLocale, type Locale } from '@nesso-how/i18n'
import type { NessoStore, VocabDefinition } from '@nesso-how/core'
import { newIri, relationKey } from '@nesso-how/schema'
import { createSeedDocument } from '../data/seed.ts'
import { createNessoStore } from './create.ts'
import { sameGraph, sameWorkspace } from './operations.ts'
import type { HostOperation, HostState, HostStore } from './types.ts'

const conceptViewId = 'intro-concept'
const connectionViewId = 'intro-connection'
export const introConnection = {
  source: 'urn:nesso:example:coffee',
  target: 'urn:nesso:example:sleep',
} as const
const seedRelationTypeId = 'urn:nesso:example:disrupts'
export const focusConceptId = 'urn:nesso:example:focus'

export function canDiscardIntroExample({ graph, workspace, preferences }: HostState) {
  if (preferences.introSeen) return false
  const seed = createSeedDocument(preferences.locale ?? defaultLocale)
  return (
    sameGraph(graph, seed.graph) &&
    sameWorkspace(
      { ...workspace, activeViewId: seed.workspace.activeViewId, viewports: {} },
      seed.workspace,
    )
  )
}

export function completeIntro(store: HostStore, { selectExample = true, keepExample = true } = {}) {
  const { graph, preferences } = store.getState()
  const operations: HostOperation[] = [{ kind: 'preferences.intro-seen' }]
  if (!keepExample && canDiscardIntroExample(store.getState())) {
    operations.push({ kind: 'document.reset', id: newIri() })
  } else if (!selectExample) operations.push({ kind: 'selection.set', value: [] })
  else if (!preferences.introSeen && graph.concepts.some(({ id }) => id === focusConceptId)) {
    operations.push({ kind: 'selection.set', value: [{ kind: 'concept', id: focusConceptId }] })
  }
  store.applyOperations(operations)
}

export function setIntroStep(store: NessoStore, step: number) {
  const { graph, workspace, vocabs, preferences } = store.getState()
  const relation = graph.relations.find(
    ({ source, target }) => source === introConnection.source && target === introConnection.target,
  )
  const defaultTypeId = vocabs.find(({ id }) => id === preferences.activeVocabId)?.defaultTypeId
  const temporaryId = step === 0 ? conceptViewId : step === 1 ? connectionViewId : null
  const fallback = step > 1 && (!relation || relation.predicate === defaultTypeId)
  store.applyOperations([
    ...(temporaryId && !workspace.savedViews.some(({ id }) => id === temporaryId)
      ? [
          {
            kind: 'view.create' as const,
            id: temporaryId,
            name: graph.concepts[0].label,
            conceptIds:
              step === 0
                ? [introConnection.source]
                : [introConnection.source, introConnection.target],
          },
        ]
      : []),
    { kind: 'view.activate', id: temporaryId ?? (step === 3 ? 'rest' : 'energy') },
    ...workspace.savedViews.flatMap(({ id }) =>
      (id === conceptViewId || id === connectionViewId) && id !== temporaryId
        ? [{ kind: 'view.remove' as const, id }]
        : [],
    ),
    ...(fallback
      ? [
          ...(relation ? [{ kind: 'relation.remove' as const, id: relationKey(relation) }] : []),
          {
            kind: 'relation.connect' as const,
            ...introConnection,
            type: createSeedDocument(preferences.locale ?? defaultLocale).graph.relationTypes.find(
              ({ id }) => id === seedRelationTypeId,
            )!,
          },
        ]
      : []),
    {
      kind: 'selection.set',
      value:
        step === 0 || (step === 1 && !relation)
          ? [{ kind: 'concept', id: introConnection.source }]
          : step === 1 && relation
            ? [{ kind: 'relation', id: relationKey(relation) }]
            : [],
    },
  ])
}

export function createIntroStore(locale: Locale, vocab: VocabDefinition, step = 0) {
  const seed = createSeedDocument(locale)
  const { store, registerVocab } = createNessoStore(
    {
      ...seed.graph,
      relations: seed.graph.relations.filter(
        ({ source, target }) =>
          source !== introConnection.source || target !== introConnection.target,
      ),
    },
    { workspace: seed.workspace },
  )
  registerVocab(vocab)
  store.setLocale(locale)
  setIntroStep(store, step)
  return store
}
