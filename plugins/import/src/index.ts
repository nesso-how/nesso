import type { NessoOperation, NessoState, Plugin } from '@nesso/plugin'
import { createTranslator, defaultLocale } from '@nesso/i18n'
import { newIri, parseGraph, relationKey, type Graph } from '@nesso/schema'
import en from './i18n/en.json' with { type: 'json' }
import it from './i18n/it.json' with { type: 'json' }

const translate = createTranslator(en, { it })

export function buildImportOperations(
  snapshot: Graph,
  state: Pick<NessoState, 'graph' | 'workspace' | 'vocabs' | 'preferences'>,
  viewId: string | null,
): NessoOperation[] {
  if (snapshot.concepts.length === 0) return []
  const vocab = state.vocabs.find((item) => item.id === state.preferences.activeVocabId)
  if (!vocab) return []
  const operations: NessoOperation[] = [{ kind: 'selection.set', value: [] }]
  const ids = new Map<string, string>()
  for (const concept of snapshot.concepts) {
    const id = newIri()
    ids.set(concept.id, id)
    operations.push(
      { kind: 'concept.add', id, position: { ...concept.position } },
      { kind: 'concept.label', id, value: concept.label },
    )
  }
  const knownTypes = new Set(state.graph.relationTypes.map((item) => item.id))
  const typeLabels = new Map(snapshot.relationTypes.map((item) => [item.id, item.label] as const))
  for (const relation of snapshot.relations) {
    const source = ids.get(relation.source)
    const target = ids.get(relation.target)
    if (!source || !target || source === target) continue
    const label = typeLabels.get(relation.predicate)
    if (label === undefined) continue
    operations.push({ kind: 'relation.connect', source, target })
    if (relation.predicate === vocab.defaultTypeId) continue
    const id = relationKey({ source, predicate: vocab.defaultTypeId, target })
    if (knownTypes.has(relation.predicate)) {
      operations.push({ kind: 'relation.type', id, typeId: relation.predicate })
    } else {
      operations.push({ kind: 'relation.type.create', id, typeId: relation.predicate, label })
      knownTypes.add(relation.predicate)
    }
  }
  const activeViewId = state.workspace.activeViewId
  if (viewId !== null && viewId !== activeViewId) {
    for (const id of ids.values()) operations.push({ kind: 'view.membership', viewId, conceptId: id, included: true })
  }
  if (activeViewId !== null && activeViewId !== viewId) {
    for (const id of ids.values()) operations.push({ kind: 'view.membership', viewId: activeViewId, conceptId: id, included: false })
  }
  return operations
}

export const importPlugin: Plugin = {
  kind: 'actions',
  metadata: (locale) => ({
    name: translate(locale)('pluginName'),
    description: translate(locale)('pluginDescription'),
    documentation: translate(locale)('pluginDocumentation'),
  }),
  operations: ['selection.set', 'concept.add', 'concept.label', 'relation.connect', 'relation.type', 'relation.type.create', 'view.membership'],
  create: ({ store }) => {
    const runOnView = (viewId: string | null) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.jsonld,.json,application/ld+json'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return
        const locale = store.getState().preferences.locale ?? defaultLocale
        file.text().then(
          (text) => {
            let snapshot: Graph
            try {
              snapshot = parseGraph(JSON.parse(text))
            } catch {
              window.alert(translate(locale)('importFailure'))
              return
            }
            store.applyOperations(buildImportOperations(snapshot, store.getState(), viewId))
          },
          () => window.alert(translate(locale)('importFailure')),
        )
      }
      input.click()
    }
    return [{
      id: 'import-view',
      label: (locale) => translate(locale)('importView'),
      run: () => runOnView(store.getState().workspace.activeViewId),
      runOnView,
    }]
  },
}
