import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button } from '@nesso-how/ui'
import type { ActionContext } from '@nesso-how/plugin'
import { createReview, type Review } from '../scheduler.ts'
import { messages } from '../i18n.ts'
import { Practice } from './practice.tsx'
import './styles.css'

export function ReviewPanel(context: ActionContext) {
  const state = useSyncExternalStore(context.document.subscribe, context.document.getState)
  const t = messages[state.locale]
  const [review, setReview] = useState<Review | 'failed' | null>(null)
  const [attempt, setAttempt] = useState(0)
  const reload = () => {
    setReview(null)
    setAttempt((attempt) => attempt + 1)
  }
  useEffect(() => {
    let active = true
    void createReview(context.storage).then(
      (review) => {
        if (active && !context.signal.aborted) setReview(review)
      },
      () => {
        if (active && !context.signal.aborted) setReview('failed')
      },
    )
    return () => {
      active = false
    }
  }, [context.storage, context.signal, attempt])
  if (!review || review === 'failed')
    return (
      <div className="review-status" role={review === 'failed' ? 'alert' : 'status'}>
        <p>{review === 'failed' ? t.restoreError : t.loading}</p>
        {review === 'failed' && (
          <Button variant="outline" onClick={reload}>
            {t.reload}
          </Button>
        )}
      </div>
    )
  return <Practice state={state} viewId={context.viewId} review={review} reload={reload} />
}
