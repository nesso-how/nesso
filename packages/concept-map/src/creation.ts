import type { NessoOperation, NessoState } from '@nesso-how/core'

type CreationState = Pick<NessoState, 'graph' | 'viewGraph' | 'workspace'>

const normalize = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

export function creationSuggestions(state: Pick<NessoState, 'graph' | 'viewGraph'>, query: string) {
  const text = normalize(query)
  if (!text) return []
  const visible = new Set(state.viewGraph.concepts.map(({ id }) => id))
  const tokens = text.split(/\s+/)
  return state.graph.concepts
    .filter(({ id }) => !visible.has(id))
    .map((concept) => {
      const label = normalize(concept.label)
      const score = !tokens.every((token) => label.includes(token))
        ? 0
        : label === text
          ? 4
          : label.startsWith(text)
            ? 3
            : label.includes(text)
              ? 2
              : 1
      return { concept, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.concept.label.localeCompare(b.concept.label))
    .slice(0, 5)
    .map(({ concept }) => concept)
}

export function reuseConceptOperations(
  state: CreationState,
  provisionalId: string,
  conceptId: string,
): NessoOperation[] {
  const viewId = state.workspace.activeViewId
  const provisional = state.viewGraph.concepts.find(({ id }) => id === provisionalId)
  if (
    !viewId ||
    !provisional?.position ||
    state.viewGraph.concepts.some(({ id }) => id === conceptId) ||
    !state.graph.concepts.some(({ id }) => id === conceptId)
  )
    return []
  return [
    { kind: 'view.membership', viewId, conceptId, included: true },
    { kind: 'concept.position', id: conceptId, value: provisional.position },
    ...state.graph.relations.flatMap((relation): NessoOperation[] => {
      if (relation.source !== provisionalId && relation.target !== provisionalId) return []
      return [
        {
          kind: 'relation.connect',
          source: relation.source === provisionalId ? conceptId : relation.source,
          target: relation.target === provisionalId ? conceptId : relation.target,
          type: state.graph.relationTypes.find(({ id }) => id === relation.predicate),
        },
      ]
    }),
    { kind: 'concept.remove', id: provisionalId },
    { kind: 'selection.set', value: [{ kind: 'concept', id: conceptId }] },
  ]
}
