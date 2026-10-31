import type { ActionState } from '@nesso-how/plugin'
import type { messages } from '../i18n.ts'

export function Reference({
  current,
  graph,
  t,
}: {
  current: ActionState['viewGraph']['concepts'][number]
  graph: ActionState['viewGraph']
  t: (typeof messages)[keyof typeof messages]
}) {
  const concepts = new Map(graph.concepts.map((concept) => [concept.id, concept]))
  const types = new Map(graph.relationTypes.map((type) => [type.id, type.label]))
  const relations = graph.relations.filter(
    ({ source, target }) => source === current.id || target === current.id,
  )
  return (
    <div className="review-answer">
      <p className="review-reference">{current.notes?.trim() ? current.notes : t.noReference}</p>
      {relations.length > 0 && (
        <section className="review-connections">
          <h2>{t.connections}</h2>
          {relations.map(({ source, predicate, target }) => (
            <div className="review-relation" key={JSON.stringify([source, predicate, target])}>
              <span>{concepts.get(source)?.label}</span>
              <span className="review-predicate">{types.get(predicate) ?? predicate} →</span>
              <span>{concepts.get(target)?.label}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
