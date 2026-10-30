import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Button, Kbd } from '@nesso-how/ui'
import type { ActionContext, ActionState } from '@nesso-how/plugin'
import type { Review } from '../scheduler.ts'
import { messages } from '../i18n.ts'
import { ConceptDot } from './concept-dot.tsx'
import { formatInterval } from './format.ts'
import { Overview } from './overview.tsx'
import { Reference } from './reference.tsx'

export function Practice({
  state,
  viewId,
  review,
  reload,
}: {
  state: ActionState
  viewId: ActionContext['viewId']
  review: Review
  reload: () => void
}) {
  const snapshot = useSyncExternalStore(review.subscribe, review.getSnapshot)
  const t = messages[state.locale]
  const [time, setTime] = useState(() => new Date())
  const heading = useRef<HTMLHeadingElement>(null)
  const reading = useRef<HTMLDivElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  const previous = useRef<{ id: string; content: HTMLElement } | null>(null)
  const { session, busy, failed } = snapshot
  const concepts = state.viewGraph.concepts
  const ids = concepts.map(({ id }) => id)
  const current = session ? concepts.find(({ id }) => id === session.ids[session.index]) : undefined
  const currentId = current?.id
  const revealed = session?.revealed ?? false
  const title = state.workspace.savedViews.find(({ id }) => id === viewId)?.name ?? t.all
  useEffect(() => {
    const tick = () => setTime(new Date())
    const timer = setInterval(tick, 15_000)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  useEffect(() => {
    review.setScope(concepts.map(({ id }) => id))
  }, [review, concepts, busy])
  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true })
    const area = reading.current
    if (!area) return
    const old = previous.current
    const scrollTop = area.scrollTop
    if (old?.id !== currentId) area.scrollTop = 0
    previous.current = currentId
      ? { id: currentId, content: area.cloneNode(true) as HTMLElement }
      : null
    const animations: Animation[] = []
    let outgoing: HTMLElement | undefined
    const fade = (element: HTMLElement | null, duration: number, delay = 0) => {
      if (!element) return
      animations.push(
        element.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration,
          delay,
          easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
          fill: 'backwards',
        }),
      )
    }
    if (old?.id && old.id !== currentId) {
      outgoing = old.content
      outgoing.classList.add('review-exit')
      outgoing.inert = true
      outgoing.setAttribute('aria-hidden', 'true')
      outgoing.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'))
      area.parentElement?.append(outgoing)
      outgoing.scrollTop = scrollTop
      const exit = outgoing.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 125 })
      exit.onfinish = () => outgoing?.remove()
      animations.push(exit)
    }
    fade(
      revealed ? area.querySelector<HTMLElement>('.review-answer') : area,
      125,
      outgoing ? 80 : 0,
    )
    fade(controls.current, 125, revealed ? 40 : 0)
    return () => {
      animations.forEach((animation) => animation.cancel())
      outgoing?.remove()
    }
  }, [currentId, revealed])
  const rate = (grade: 1 | 2 | 3 | 4) => {
    review.setScope(ids)
    void review.rate(grade)
  }
  const start = () => {
    review.setScope(ids)
    setTime(new Date())
    review.start()
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (busy || failed || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (
        event.target instanceof Element &&
        event.target.closest('input,textarea,select,[contenteditable="true"]')
      )
        return
      if (event.code === 'Space' && !revealed) {
        event.preventDefault()
        if (session) review.reveal()
        else start()
      } else if (session && revealed && /^[1-4]$/.test(event.key)) {
        event.preventDefault()
        rate(Number(event.key) as 1 | 2 | 3 | 4)
      } else if (session && event.key === 'Escape') {
        event.preventDefault()
        review.finish()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  })
  const previews = current ? review.preview(current.id, time) : []
  const ratings = { 1: t.again, 2: t.hard, 3: t.good, 4: t.easy }
  return (
    <div className="review-panel" aria-busy={busy}>
      {failed && (
        <div className="review-error" role="alert">
          <p>{t.saveError}</p>
          <Button variant="outline" onClick={reload}>
            {t.reload}
          </Button>
        </div>
      )}
      <div className={`review-main${current ? ' is-studying' : ''}`}>
        <div ref={reading} className="review-reading">
          {current && session ? (
            <div className="review-study review-width">
              <p className="review-step">
                {session.index + 1} / {session.ids.length}
              </p>
              <div className="review-question">
                <ConceptDot color={current.color} />
                <h1 ref={heading} tabIndex={-1}>
                  {current.label}
                </h1>
              </div>
              {revealed ? (
                <Reference current={current} graph={state.viewGraph} t={t} />
              ) : (
                <p className="review-prompt">{t.prompt}</p>
              )}
            </div>
          ) : (
            <Overview
              state={state}
              review={review}
              snapshot={snapshot}
              time={time}
              title={title}
              heading={heading}
              onStart={() => start()}
            />
          )}
        </div>
      </div>
      {current && (
        <div className="review-bottom">
          <div ref={controls} className="review-controls review-width">
            {revealed ? (
              <>
                <p className="review-rating-title">
                  {t.rate} <span className="review-rating-keys">1–4</span>
                </p>
                <div className="review-ratings">
                  {previews.map(({ grade, card }) => (
                    <Button
                      key={grade}
                      variant="outline"
                      disabled={busy || failed}
                      aria-keyshortcuts={String(grade)}
                      onClick={() => rate(grade)}
                    >
                      <span>{ratings[grade]}</span>
                      <span className="review-rating-interval">
                        {formatInterval(card.dueAt, time, t)}
                      </span>
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <div className="review-reveal">
                <Button
                  disabled={busy || failed}
                  aria-keyshortcuts="Space"
                  onClick={() => review.reveal()}
                >
                  {t.reveal}
                </Button>
                <Kbd>{t.space}</Kbd>
              </div>
            )}
            <Button
              className="review-end"
              variant="ghost"
              disabled={busy}
              aria-keyshortcuts="Escape"
              onClick={() => review.finish()}
            >
              {t.end}
            </Button>
          </div>
        </div>
      )}
      <span className="review-sr" role="status" aria-live="polite">
        {!busy && session && session.index > 0 ? t.recorded : ''}
      </span>
    </div>
  )
}
