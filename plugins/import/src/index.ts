import { PluginError, type NessoOperation } from '@nesso-how/plugin'
import type { ActionContribution } from '@nesso-how/plugin/runtime'
import { newIri, parseGraph, type Graph } from '@nesso-how/schema'
import source from '../package.json' with { type: 'json' }

const { i18n } = source

export function deriveViewName(fileName: string): string {
  const base = fileName.replace(/\.(jsonld|json)$/i, '')
  const stripped = base.toLowerCase().startsWith('nesso-') ? base.slice(6) : base
  const spaced = stripped.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  const raw = spaced || base.trim() || 'Import'
  const name = raw.slice(0, 70).trim()
  return (name.charAt(0).toUpperCase() + name.slice(1)) || 'Import'
}

export function buildImportOperations(
  snapshot: Graph,
  viewId: string,
  viewName: string,
): NessoOperation[] {
  if (snapshot.concepts.length === 0) return []
  const operations: NessoOperation[] = [
    { kind: 'view.create', id: viewId, name: viewName, conceptIds: [] },
  ]
  const ids = new Map<string, string>()
  for (const concept of snapshot.concepts) {
    const id = newIri()
    ids.set(concept.id, id)
    operations.push(
      { kind: 'selection.set', value: [] },
      { kind: 'concept.add', id, position: { ...concept.position } },
      { kind: 'concept.label', id, value: concept.label },
    )
    if (concept.notes !== undefined)
      operations.push({ kind: 'concept.notes', id, value: concept.notes })
    if (concept.color !== undefined)
      operations.push({ kind: 'concept.color', id, value: concept.color })
    if (concept.bold !== undefined)
      operations.push({ kind: 'concept.bold', id, value: concept.bold })
    if (concept.italic !== undefined)
      operations.push({ kind: 'concept.italic', id, value: concept.italic })
  }
  const types = new Map(snapshot.relationTypes.map((type) => [type.id, type]))
  for (const relation of snapshot.relations) {
    const source = ids.get(relation.source)
    const target = ids.get(relation.target)
    if (!source || !target || source === target) continue
    const type = types.get(relation.predicate)
    if (type) operations.push({ kind: 'relation.connect', source, target, type })
  }
  operations.push({ kind: 'selection.set', value: [] })
  return operations
}

class ImportError extends PluginError {
  override name = 'ImportError'
  constructor() {
    super('failed', [{ path: 'import', message: i18n.importFailure.en }], i18n.importFailure)
  }
}

export const create = (): readonly ActionContribution[] => [
  {
    id: 'import',
    label: i18n.label,
    icon: 'upload',
    run: async ({ document, files }) => {
      const file = await files.open({
        extensions: ['jsonld', 'json'],
        mimeTypes: ['application/ld+json', 'application/json'],
      })
      if (!file) return
      await document.refresh()
      let operations: NessoOperation[]
      try {
        operations = buildImportOperations(
          parseGraph(JSON.parse(file.text)),
          newIri(),
          deriveViewName(file.name),
        )
      } catch {
        throw new ImportError()
      }
      await document.applyOperations(operations)
    },
  },
]
