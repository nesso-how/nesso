import type { NessoOperation, NessoState, Plugin } from '@nesso/plugin'
import { createTranslator, defaultLocale } from '@nesso/i18n'
import { newIri, parseGraph, type Graph } from '@nesso/schema'
import en from './i18n/en.json' with { type: 'json' }
import it from './i18n/it.json' with { type: 'json' }
import zhCN from './i18n/zh-CN.json' with { type: 'json' }

const translate = createTranslator(en, { it, 'zh-CN': zhCN })

export function buildImportOperations(
  snapshot: Graph,
  state: Pick<NessoState, 'workspace'>,
  viewId: string | null,
): NessoOperation[] {
  if (snapshot.concepts.length === 0) return []
  const operations: NessoOperation[] = []
  const ids = new Map<string, string>()
  for (const concept of snapshot.concepts) {
    const id = newIri()
    ids.set(concept.id, id)
    operations.push(
      { kind: 'selection.set', value: [] },
      { kind: 'concept.add', id, position: { ...concept.position } },
      { kind: 'concept.label', id, value: concept.label },
    )
    if (concept.description !== undefined) operations.push({ kind: 'concept.description', id, value: concept.description })
  }
  const types = new Map(snapshot.relationTypes.map((type) => [type.id, type]))
  for (const relation of snapshot.relations) {
    const source = ids.get(relation.source)
    const target = ids.get(relation.target)
    if (!source || !target || source === target) continue
    const type = types.get(relation.predicate)
    if (type) operations.push({ kind: 'relation.connect', source, target, type })
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
  operations: ['selection.set', 'concept.add', 'concept.label', 'concept.description', 'relation.connect', 'view.membership'],
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
            try {
              store.applyOperations(buildImportOperations(parseGraph(JSON.parse(text)), store.getState(), viewId))
            } catch {
              window.alert(translate(locale)('importFailure'))
            }
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
