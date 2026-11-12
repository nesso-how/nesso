import { PluginError, type NessoOperation } from '@nesso-how/plugin'
import type { ActionContribution } from '@nesso-how/plugin/runtime'
import { newIri, parseGraph, type Concept, type Position, type View } from '@nesso-how/schema'
import source from '../package.json' with { type: 'json' }

const { i18n } = source

export function deriveViewName(fileName: string): string {
  const base = fileName.replace(/\.(jsonld|json)$/i, '')
  const stripped = base.toLowerCase().startsWith('nesso-') ? base.slice(6) : base
  const spaced = stripped.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  const raw = spaced || base.trim() || 'Import'
  const name = raw.slice(0, 70).trim()
  return name.charAt(0).toUpperCase() + name.slice(1) || 'Import'
}

const gridPosition = (index: number, count: number): Position => {
  const columns = Math.ceil(Math.sqrt(count))
  return { x: (index % columns) * 240, y: Math.floor(index / columns) * 120 }
}

export function buildImportOperations(
  { graph, views: fileViews }: ReturnType<typeof parseGraph>,
  activeViewId: string | null,
  viewName: string,
): NessoOperation[] {
  if (graph.concepts.length === 0) return []
  const views: readonly Pick<View, 'name' | 'members'>[] = fileViews.length
    ? fileViews
    : [
        {
          name: '',
          members: graph.concepts.map(({ id }, index) => ({
            id,
            position: gridPosition(index, graph.concepts.length),
          })),
        },
      ]
  const ids = new Map(graph.concepts.map((concept) => [concept.id, newIri()]))
  const concepts = new Map(graph.concepts.map((concept) => [concept.id, concept]))
  const listed = new Set(views.flatMap(({ members }) => members.map(({ id }) => id)))
  const added = new Set<string>()
  const operations: NessoOperation[] = []
  const add = (concept: Concept, position?: Position) => {
    const id = ids.get(concept.id)!
    added.add(concept.id)
    operations.push(
      { kind: 'selection.set', value: [] },
      { kind: 'concept.add', id, ...(position ? { position: { ...position } } : {}) },
      { kind: 'concept.label', id, value: concept.label },
    )
    if (concept.notes !== undefined)
      operations.push({ kind: 'concept.notes', id, value: concept.notes })
  }
  for (const concept of graph.concepts) {
    if (listed.has(concept.id)) continue
    add(concept)
    if (activeViewId !== null)
      operations.push({
        kind: 'view.membership',
        viewId: activeViewId,
        conceptId: ids.get(concept.id)!,
        included: false,
      })
  }
  for (const view of views) {
    const viewId = newIri()
    operations.push({
      kind: 'view.create',
      id: viewId,
      name: view.name.trim() || viewName,
      conceptIds: [],
    })
    for (const member of view.members) {
      const id = ids.get(member.id)!
      if (added.has(member.id))
        operations.push(
          { kind: 'view.membership', viewId, conceptId: id, included: true },
          { kind: 'concept.position', id, value: { ...member.position } },
        )
      else add(concepts.get(member.id)!, member.position)
      if (member.color !== undefined)
        operations.push({ kind: 'concept.color', id, value: member.color })
      if (member.bold !== undefined)
        operations.push({ kind: 'concept.bold', id, value: member.bold })
      if (member.italic !== undefined)
        operations.push({ kind: 'concept.italic', id, value: member.italic })
    }
  }
  const types = new Map(graph.relationTypes.map((type) => [type.id, type]))
  for (const relation of graph.relations) {
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
      const state = await document.refresh()
      let operations: NessoOperation[]
      try {
        operations = buildImportOperations(
          parseGraph(JSON.parse(file.text)),
          state.workspace.activeViewId,
          deriveViewName(file.name),
        )
      } catch {
        throw new ImportError()
      }
      await document.applyOperations(operations)
    },
  },
]
