import type { ActionState } from '@nesso-how/plugin'
import { MarkdownInput } from '@nesso-how/ui'
import { cues, relationTypeLabels } from '../cues.ts'
import type { messages } from '../i18n.ts'

type Props = {
  current: ActionState['viewGraph']['concepts'][number]
  state: ActionState
  t: (typeof messages)[keyof typeof messages]
}

export function Prompt({ current, state, t }: Props) {
  const items = cues(current.id, state)
  if (!items.length) return <p className="review-prompt">{t.prompt}</p>
  const blank = <span className="review-blank">?</span>
  const self = <span>{current.label}</span>
  return (
    <>
      <p className="review-prompt">{current.notes?.trim() ? t.explainAll : t.recall}</p>
      <section className="review-connections">
        {items.map(({ key, outgoing, label }) => (
          <div className="review-relation" key={key}>
            {outgoing ? self : blank}
            <span className="review-predicate">{label} →</span>
            {outgoing ? blank : self}
          </div>
        ))}
      </section>
    </>
  )
}

export function Reference({ current, state, t }: Props) {
  const graph = state.viewGraph
  const concepts = new Map(graph.concepts.map((concept) => [concept.id, concept]))
  const types = relationTypeLabels(state)
  const relations = graph.relations.filter(
    ({ source, target }) => source === current.id || target === current.id,
  )
  return (
    <div className="review-answer">
      {current.notes?.trim() ? (
        <MarkdownInput
          key={current.id}
          className="review-reference min-h-0 overflow-visible border-0 bg-transparent p-0"
          aria-label={current.label}
          value={current.notes}
          onChange={() => {}}
          readOnly
          history={false}
        />
      ) : (
        <p className="review-reference">{t.noReference}</p>
      )}
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
