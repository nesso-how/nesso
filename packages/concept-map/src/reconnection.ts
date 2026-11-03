import type { GraphSnapshot, NessoOperation, Selection } from '@nesso-how/core'
import { relationKey } from '@nesso-how/schema'

type Relation = GraphSnapshot['relations'][number]
type Endpoint = 'source' | 'target'

export type Reconnection = {
  relations: readonly Relation[]
  endpoint: Endpoint
}

export function selectedRelations(graph: GraphSnapshot, selected: Selection): readonly Relation[] {
  if (selected.some(({ kind }) => kind !== 'relation')) return []
  const ids = new Set(selected.map(({ id }) => id))
  const relations = graph.relations.filter((relation) => ids.has(relationKey(relation)))
  return relations.length === selected.length ? relations : []
}

export function reconnectableEndpoints(relations: readonly Relation[]): boolean | Endpoint {
  if (!relations.length) return false
  const source = relations.every((relation) => relation.source === relations[0].source)
  const target = relations.every((relation) => relation.target === relations[0].target)
  return source && target ? true : source ? 'source' : target ? 'target' : false
}

export function reconnectOperations(
  graph: GraphSnapshot,
  { relations, endpoint }: Reconnection,
  nodeId: string,
): NessoOperation[] {
  const allowed = reconnectableEndpoints(relations)
  if (!allowed || (allowed !== true && allowed !== endpoint)) return []
  if (!graph.concepts.some(({ id }) => id === nodeId)) return []
  const current = new Set(graph.relations.map(relationKey))
  const operations: NessoOperation[] = []
  for (const relation of relations) {
    const id = relationKey(relation)
    const next = { ...relation, [endpoint]: nodeId }
    const key = relationKey(next)
    if (!current.has(id) || next.source === next.target || (key !== id && current.has(key)))
      return []
    operations.push({
      kind: 'relation.reconnect',
      id,
      source: next.source,
      target: next.target,
    })
  }
  return operations
}
