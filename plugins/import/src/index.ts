import { PluginError, type NessoOperation } from '@nesso-how/plugin'
import type { ActionContribution } from '@nesso-how/plugin/runtime'
import { newIri, parseGraph, type Graph } from '@nesso-how/schema'
import source from '../package.json' with { type: 'json' }

const { i18n } = source

export function buildImportOperations(
  snapshot: Graph,
  activeViewId: string | null,
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
  if (viewId !== null && viewId !== activeViewId) {
    for (const id of ids.values()) operations.push({ kind: 'view.membership', viewId, conceptId: id, included: true })
  }
  if (activeViewId !== null && activeViewId !== viewId) {
    for (const id of ids.values()) operations.push({ kind: 'view.membership', viewId: activeViewId, conceptId: id, included: false })
  }
  return operations
}

class ImportError extends PluginError {
  override name = 'ImportError'
  constructor() { super('failed', [{ path: 'import', message: i18n.importFailure.en }], i18n.importFailure) }
}

export const create = (): readonly ActionContribution[] => [{
  id: 'import-view', label: i18n.label, icon: 'upload',
  run: async ({ document, files, viewId }) => {
    const file = await files.open({ extensions: ['jsonld', 'json'], mimeTypes: ['application/ld+json', 'application/json'] })
    if (!file) return
    const state = await document.refresh()
    let operations: NessoOperation[]
    try {
      operations = buildImportOperations(parseGraph(JSON.parse(file.text)), state.workspace.activeViewId, viewId)
    } catch { throw new ImportError() }
    await document.applyOperations(operations)
  },
}]
