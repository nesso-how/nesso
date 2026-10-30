import type { MouseEvent, RefObject } from 'react'
import { Button, Kbd } from '@nesso-how/ui'
import type { ActionState } from '@nesso-how/plugin'
import type { Review } from '../scheduler.ts'
import { messages } from '../i18n.ts'
import { ConceptDot } from './concept-dot.tsx'
import { formatInterval } from './format.ts'

export function Overview({
  state,
  review,
  snapshot,
  time,
  title,
  heading,
  onStart,
}: {
  state: ActionState
  review: Review
  snapshot: ReturnType<Review['getSnapshot']>
  time: Date
  title: string
  heading: RefObject<HTMLHeadingElement | null>
  onStart: (event: MouseEvent) => void
}) {
  const { progress, outcome, busy, failed } = snapshot
  const t = messages[state.locale]
  const ready = new Set(
    review.due(
      state.viewGraph.concepts.map(({ id }) => id),
      time,
    ),
  )
  const ordered = [...state.viewGraph.concepts].sort(
    (a, b) =>
      Number(ready.has(b.id)) - Number(ready.has(a.id)) ||
      (progress.get(a.id)?.card.dueAt.getTime() ?? 0) -
        (progress.get(b.id)?.card.dueAt.getTime() ?? 0),
  )
  const next = ordered[0] && progress.get(ordered[0].id)?.card.dueAt
  return (
    <div className="review-overview review-width">
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      {outcome ? (
        <div className="review-outcome" role="status">
          <p>
            {outcome.complete && (
              <>
                <strong>{t.complete}</strong> ·{' '}
              </>
            )}
            {outcome.reviewed} {outcome.reviewed === 1 ? t.reviewedOne : t.reviewed}
            {ready.size > 0 && (
              <>
                {' '}
                · {ready.size} {t.stillReady}
              </>
            )}
          </p>
          {!ready.size && next && (
            <p>
              {t.next} {t.inTime} {formatInterval(next, time, t)}.
            </p>
          )}
        </div>
      ) : (
        <p className="review-intro">
          {ready.size ? `${ready.size} ${ready.size === 1 ? t.readyOne : t.ready}` : t.nothingDue}
        </p>
      )}
      {ordered.length ? (
        <ul className="review-list" tabIndex={0} aria-label={t.concepts}>
          {ordered.map((concept) => {
            const record = progress.get(concept.id)
            return (
              <li key={concept.id} className={ready.has(concept.id) ? '' : 'is-scheduled'}>
                <ConceptDot color={concept.color} />
                <span className="review-name">{concept.label}</span>
                <span className="review-time">
                  {!record
                    ? t.new
                    : ready.has(concept.id)
                      ? t.now
                      : `${t.inTime} ${formatInterval(record.card.dueAt, time, t)}`}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="review-empty">{t.noConcepts}</p>
      )}
      {ready.size > 0 && (
        <div className="review-start">
          <Button disabled={failed || busy} aria-keyshortcuts="Space" onClick={onStart}>
            {t.start}
          </Button>
          <Kbd>{t.space}</Kbd>
        </div>
      )}
    </div>
  )
}
