import type { GraphOperation, GraphSnapshot, NessoState } from '@nesso/plugin'
import { relationKey, SchemaError, type RelationType } from '@nesso/schema'

export const conceptPlacementOffset = Object.freeze({ x: 160, y: 100 })

const sameItems = <T>(left: readonly T[], right: readonly T[], equal: (left: T, right: T) => boolean): boolean =>
  left === right || (left.length === right.length && left.every((item, index) => item === right[index] || equal(item, right[index])))

const sameGraph = (left: GraphSnapshot, right: GraphSnapshot): boolean =>
  sameItems(left.concepts, right.concepts, (a, b) =>
    a.id === b.id && a.label === b.label && a.position.x === b.position.x && a.position.y === b.position.y)
  && sameItems(left.relations, right.relations, (a, b) => relationKey(a) === relationKey(b))
  && sameItems(left.relationTypes, right.relationTypes, (a, b) => a.id === b.id && a.label === b.label)

export const applyGraphOperations = (state: NessoState, operations: readonly GraphOperation[]) => {
  let graph = state.graph
  let selected = state.selected

  const activeVocab = () => {
    const vocab = state.vocabs.find((item) => item.id === state.preferences.activeVocabId)
    if (!vocab) throw new SchemaError([{ path: 'activeVocabId', message: 'No active vocabulary' }])
    return vocab
  }

  const withType = (type: Readonly<RelationType>): GraphSnapshot['relationTypes'] =>
    graph.relationTypes.some((item) => item.id === type.id) ? graph.relationTypes : [...graph.relationTypes, { ...type }]

  const updateConcept = (
    id: string,
    update: (concept: GraphSnapshot['concepts'][number]) => GraphSnapshot['concepts'][number],
  ): void => {
    const concept = graph.concepts.find((item) => item.id === id)
    if (!concept) return
    const next = update(concept)
    if (next !== concept) graph = { ...graph, concepts: graph.concepts.map((item) => item === concept ? next : item) }
  }

  const setPositions = (updates: Extract<GraphOperation, { kind: 'concept.positions' }>['updates']): void => {
    if (updates.length === 0) return
    const positions = new Map(updates.map(({ id, position }) => [id, position]))
    let changed = false
    const concepts = graph.concepts.map((concept) => {
      const position = positions.get(concept.id)
      if (!position || (position.x === concept.position.x && position.y === concept.position.y)) return concept
      changed = true
      return { ...concept, position: { x: position.x, y: position.y } }
    })
    if (changed) graph = { ...graph, concepts }
  }

  const retypeRelation = (id: string, type: Readonly<RelationType>): void => {
    const relation = graph.relations.find((item) => relationKey(item) === id)
    if (!relation || relation.predicate === type.id) return
    const triple = relationKey({ ...relation, predicate: type.id })
    if (graph.relations.some((item) => relationKey(item) === triple)) return
    graph = {
      ...graph,
      relationTypes: withType(type),
      relations: graph.relations.map((item) => item === relation ? { ...item, predicate: type.id } : item),
    }
    selected = { kind: 'relation', id: triple }
  }

  for (const operation of operations) {
    switch (operation.kind) {
      case 'concept.label':
        updateConcept(operation.id, (concept) => concept.label === operation.value ? concept : { ...concept, label: operation.value })
        break
      case 'concept.position':
        setPositions([{ id: operation.id, position: operation.value }])
        break
      case 'concept.positions':
        setPositions(operation.updates)
        break
      case 'concept.add': {
        const source = selected?.kind === 'concept'
          ? graph.concepts.find((concept) => concept.id === selected?.id)
          : undefined
        const vocab = source ? activeVocab() : null
        const type = vocab?.relationTypes.find((item) => item.id === vocab.defaultTypeId)
        graph = {
          ...graph,
          relationTypes: type ? withType(type) : graph.relationTypes,
          concepts: [...graph.concepts, {
            id: operation.id,
            label: `Concept ${graph.concepts.length + 1}`,
            position: operation.position ? { x: operation.position.x, y: operation.position.y } : {
              x: (source?.position.x ?? 0) + conceptPlacementOffset.x,
              y: (source?.position.y ?? 0) + conceptPlacementOffset.y,
            },
          }],
          relations: source && vocab ? [...graph.relations, { source: source.id, predicate: vocab.defaultTypeId, target: operation.id }] : graph.relations,
        }
        selected = { kind: 'concept', id: operation.id }
        break
      }
      case 'concept.remove': {
        if (!graph.concepts.some((concept) => concept.id === operation.id)) break
        const relations = graph.relations.filter((relation) => relation.source !== operation.id && relation.target !== operation.id)
        graph = {
          ...graph,
          concepts: graph.concepts.filter((concept) => concept.id !== operation.id),
          relations: relations.length === graph.relations.length ? graph.relations : relations,
        }
        break
      }
      case 'relation.connect': {
        if (!operation.source || !operation.target || operation.source === operation.target) break
        const vocab = activeVocab()
        const relation = { source: operation.source, predicate: vocab.defaultTypeId, target: operation.target }
        const key = relationKey(relation)
        if (graph.relations.some((item) => relationKey(item) === key)) break
        const type = vocab.relationTypes.find((item) => item.id === vocab.defaultTypeId) ?? { id: vocab.defaultTypeId, label: '' }
        graph = { ...graph, relationTypes: withType(type), relations: [...graph.relations, relation] }
        selected = { kind: 'relation', id: key }
        break
      }
      case 'relation.type': {
        const type = graph.relationTypes.find((item) => item.id === operation.typeId)
          ?? activeVocab().relationTypes.find((item) => item.id === operation.typeId)
        if (!type) throw new SchemaError([{ path: 'relationTypeId', message: `Unknown relation type: ${operation.typeId}` }])
        retypeRelation(operation.id, type)
        break
      }
      case 'relation.type.create': {
        const label = operation.label.trim()
        if (!label) throw new SchemaError([{ path: 'label', message: 'Relation type label must not be empty' }])
        if (graph.relationTypes.some((type) => type.id === operation.typeId)) {
          throw new SchemaError([{ path: 'relationTypeId', message: `Duplicate relation type IRI: ${operation.typeId}` }])
        }
        retypeRelation(operation.id, { id: operation.typeId, label })
        break
      }
      case 'relation.remove': {
        const relations = graph.relations.filter((relation) => relationKey(relation) !== operation.id)
        if (relations.length !== graph.relations.length) graph = { ...graph, relations }
        break
      }
      default:
        throw new SchemaError([{ path: 'operations', message: 'Unknown graph operation' }])
    }
  }

  return graph === state.graph || sameGraph(graph, state.graph)
    ? { graph: state.graph, selected: state.selected }
    : { graph, selected }
}
