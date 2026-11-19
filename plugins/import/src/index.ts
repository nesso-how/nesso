import { PluginError, type NessoOperation } from '@nesso-how/plugin'
import type { ActionContribution } from '@nesso-how/plugin/runtime'
import { newIri, parseGraph, relationKey, type Concept, type Position } from '@nesso-how/schema'
import source from '../package.json' with { type: 'json' }

const { i18n } = source

export function deriveMapName(fileName: string): string {
  const base = fileName.replace(/\.(jsonld|json)$/i, '')
  const stripped = base.toLowerCase().startsWith('nesso-') ? base.slice(6) : base
  const spaced = stripped.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  const raw = spaced || base.trim() || 'Import'
  const name = raw.slice(0, 70).trim()
  return name.charAt(0).toUpperCase() + name.slice(1) || 'Import'
}

export function buildImportOperations(
  { graph, maps }: ReturnType<typeof parseGraph>,
  activeMapId: string | null,
  mapName: string,
): NessoOperation[] {
  if (graph.concepts.length === 0) return []
  const ids = new Map(graph.concepts.map((concept) => [concept.id, newIri()]))
  const concepts = new Map(graph.concepts.map((concept) => [concept.id, concept]))
  const listed = new Set(maps.flatMap(({ members }) => members.map(({ id }) => id)))
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
  const types = new Map(graph.relationTypes.map((type) => [type.id, type]))
  const pending = new Set(graph.relations)
  const connect = () => {
    for (const relation of pending) {
      if (!added.has(relation.source) || !added.has(relation.target)) continue
      pending.delete(relation)
      const type = types.get(relation.predicate)
      if (type && relation.source !== relation.target)
        operations.push({
          kind: 'relation.connect',
          source: ids.get(relation.source)!,
          target: ids.get(relation.target)!,
          type,
        })
    }
  }
  for (const concept of graph.concepts) {
    if (listed.has(concept.id)) continue
    add(concept)
    if (activeMapId !== null)
      operations.push({
        kind: 'map.membership',
        mapId: activeMapId,
        conceptId: ids.get(concept.id)!,
        included: false,
      })
  }
  for (const map of maps) {
    const mapId = newIri()
    operations.push({
      kind: 'map.create',
      id: mapId,
      name: map.name.trim() || mapName,
      conceptIds: [],
    })
    for (const member of map.members) {
      const id = ids.get(member.id)!
      if (added.has(member.id))
        operations.push(
          { kind: 'map.membership', mapId, conceptId: id, included: true },
          { kind: 'concept.position', id, value: { ...member.position } },
        )
      else add(concepts.get(member.id)!, member.position)
      if (member.color !== undefined)
        operations.push({ kind: 'concept.color', id, value: member.color })
      if (member.bold !== undefined)
        operations.push({ kind: 'concept.bold', id, value: member.bold })
      if (member.italic !== undefined)
        operations.push({ kind: 'concept.italic', id, value: member.italic })
      if (member.strikethrough !== undefined)
        operations.push({ kind: 'concept.strikethrough', id, value: member.strikethrough })
    }
    connect()
    for (const relation of map.relationBends ?? [])
      operations.push({
        kind: 'relation.bend',
        id: relationKey({
          source: ids.get(relation.source)!,
          predicate: relation.predicate,
          target: ids.get(relation.target)!,
        }),
        value: relation.bend,
      })
  }
  connect()
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
          state.workspace.activeMapId,
          deriveMapName(file.name),
        )
      } catch {
        throw new ImportError()
      }
      await document.applyOperations(operations)
    },
  },
]
