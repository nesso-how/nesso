import type { ActionState } from '@nesso-how/plugin'

type Graph = ActionState['viewGraph']

export function cues(conceptId: string, graph: Graph) {
  const types = new Map(graph.relationTypes.map(({ id, label }) => [id, label]))
  const seen = new Map<string, { outgoing: boolean; label: string }>()
  for (const { source, predicate, target } of graph.relations) {
    if (source !== conceptId && target !== conceptId) continue
    const outgoing = source === conceptId
    seen.set(JSON.stringify([outgoing, predicate]), {
      outgoing,
      label: types.get(predicate) ?? predicate,
    })
  }
  return [...seen.entries()].map(([key, cue]) => ({ key, ...cue }))
}
