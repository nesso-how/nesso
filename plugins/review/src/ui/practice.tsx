import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Button, Kbd, PluginContent, PluginPage } from '@nesso-how/ui'
import type { ActionContext, ActionState } from '@nesso-how/plugin'
import type { Review } from '../scheduler.ts'
import { messages } from '../i18n.ts'
import { ConceptDot } from './concept-dot.tsx'
import { formatInterval } from './format.ts'
import { Overview, UndoButton } from './overview.tsx'
import { Prompt, Reference } from './reference.tsx'

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
  const previous = useRef<string>(undefined)
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
    if (previous.current === currentId) return
    previous.current = currentId
    const area = reading.current
    if (!area) return
    area.scrollTop = 0
    const study = area.querySelector('.review-study')
    if (study) study.scrollTop = 0
  }, [currentId, revealed])
  const rate = (grade: 1 | 2 | 3 | 4) => {
    review.setScope(ids)
    void review.rate(grade)
  }
  const undoable = snapshot.history.length > 0
  const undo = () => {
    review.setScope(ids)
    void review.undo()
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
      } else if (undoable && event.key === 'Backspace') {
        event.preventDefault()
        undo()
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
  const undoButton = undoable && <UndoButton t={t} disabled={busy || failed} onClick={undo} />
  const endButton = (
    <Button
      className="review-end review-finish"
      variant="ghost"
      disabled={busy}
      aria-keyshortcuts="Escape"
      onClick={() => review.finish()}
    >
      {t.end}
      <Kbd>Esc</Kbd>
    </Button>
  )
  return (
    <PluginPage className="review-panel" aria-busy={busy}>
      {failed && (
        <div className="review-error" role="alert">
          <p>{t.saveError}</p>
          <Button variant="outline" onClick={reload}>
            {t.reload}
          </Button>
        </div>
      )}
      <div className={`review-main${current ? ' is-studying' : ''}`}>
        <div ref={reading} className="review-reading nesso-scroll">
          {current && session ? (
            <PluginContent className="review-study nesso-scroll">
              <p className="review-step">
                {session.index + 1} / {session.ids.length}
              </p>
              <div className="review-progress" aria-hidden="true">
                <span style={{ transform: `scaleX(${session.index / session.ids.length})` }} />
              </div>
              <div className="review-question">
                <ConceptDot color={current.color} />
                <h1 ref={heading} tabIndex={-1}>
                  {current.label}
                </h1>
              </div>
              {revealed ? (
                <Reference current={current} state={state} t={t} />
              ) : (
                <Prompt current={current} state={state} t={t} />
              )}
            </PluginContent>
          ) : (
            <Overview
              state={state}
              review={review}
              snapshot={snapshot}
              time={time}
              title={title}
              heading={heading}
              onStart={() => start()}
              onUndo={undoable ? undo : undefined}
            />
          )}
          {current && (
            <PluginContent className="review-controls nesso-scroll">
              {revealed ? (
                <>
                  <p className="review-rating-title">
                    {t.rate} <Kbd className="review-rating-keys">1–4</Kbd>
                  </p>
                  <div className="review-ratings">
                    {previews.map(({ grade, card }) => (
                      <Button
                        key={grade}
                        className={`review-rating-grade-${grade}`}
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
                  <div className="review-session-actions">
                    {undoButton}
                    {endButton}
                  </div>
                </>
              ) : (
                <>
                  <div className="review-reveal">
                    <Button
                      disabled={busy || failed}
                      aria-keyshortcuts="Space"
                      onClick={() => review.reveal()}
                    >
                      {t.reveal}
                    </Button>
                    <Kbd>{t.space}</Kbd>
                    {endButton}
                  </div>
                  {undoButton && <div className="review-session-actions">{undoButton}</div>}
                </>
              )}
            </PluginContent>
          )}
        </div>
      </div>
      <span className="review-sr" role="status" aria-live="polite">
        {!busy && session && session.index > 0 ? t.recorded : ''}
      </span>
    </PluginPage>
  )
}
