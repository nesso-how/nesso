import type { GraphSnapshot, Selection, NessoOperation } from '@nesso-how/core'
import { newIri, relationKey } from '@nesso-how/schema'

export function relationSelection(graph: GraphSnapshot, selected: Selection) {
  if (!selected.length || selected.some(({ kind }) => kind !== 'relation')) return []
  const ids = new Set(selected.map(({ id }) => id))
  const relations = graph.relations.filter((relation) => ids.has(relationKey(relation)))
  const first = relations[0]
  return first &&
    relations.length === ids.size &&
    relations.every((relation) => relation.predicate === first.predicate) &&
    (relations.every((relation) => relation.source === first.source) ||
      relations.every((relation) => relation.target === first.target))
    ? relations
    : []
}

export function relationTypeOperations(
  relations: GraphSnapshot['relations'],
  type: { id: string } | { label: string },
): NessoOperation[] {
  const typeId = 'id' in type ? type.id : newIri()
  return relations.map((relation, index) =>
    'label' in type && index === 0
      ? { kind: 'relation.type.create', id: relationKey(relation), typeId, label: type.label }
      : { kind: 'relation.type', id: relationKey(relation), typeId },
  )
}
