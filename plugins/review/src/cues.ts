import { resolveRelationTypeLabel, type ActionState } from '@nesso-how/plugin'

type State = Pick<ActionState, 'viewGraph' | 'activeVocab' | 'locale'>

export function relationTypeLabels({ viewGraph, activeVocab, locale }: State) {
  const vocabs = activeVocab ? [activeVocab] : []
  return new Map(
    viewGraph.relationTypes.map((type) => [
      type.id,
      resolveRelationTypeLabel(type, vocabs, locale),
    ]),
  )
}

export function cues(conceptId: string, state: State) {
  const types = relationTypeLabels(state)
  const seen = new Map<string, { outgoing: boolean; label: string }>()
  for (const { source, predicate, target } of state.viewGraph.relations) {
    if (source !== conceptId && target !== conceptId) continue
    const outgoing = source === conceptId
    seen.set(JSON.stringify([outgoing, predicate]), {
      outgoing,
      label: types.get(predicate) ?? predicate,
    })
  }
  return [...seen.entries()].map(([key, cue]) => ({ key, ...cue }))
}
