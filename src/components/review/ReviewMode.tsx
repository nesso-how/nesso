// SPDX-License-Identifier: MIT
import { useState, useMemo, useLayoutEffect, useRef, useEffect, type CSSProperties } from 'react'
import { fsrs, Rating, type Grade } from 'ts-fsrs'
import { RELATION_TYPES, RELATION_CATEGORY_COLORS } from '@/data/relationTypes'
import { sortedDueConceptNodes } from '@/data/fsrsDueQueue'
import { useGraphStore } from '@/store'
import { nodeToCard, type RelationTypeName } from '@/types/graph'
import { ratingColor } from '@nesso-how/graph'
import { useT } from '@/i18n'
import { isTextControlFocused } from '@/lib/shortcuts'
import { CloseButton } from '@/components/ui/CloseButton'
import { ModalOverlay } from '@/components/ui/ModalOverlay'
import { track, toCountBucket } from '@/telemetry'

const RATINGS = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const

const RATING_EVENT_NAMES = {
  [Rating.Again]: 'again',
  [Rating.Hard]: 'hard',
  [Rating.Good]: 'good',
  [Rating.Easy]: 'easy',
} as const satisfies Record<(typeof RATINGS)[number], 'again' | 'hard' | 'good' | 'easy'>

type IntervalLabels = {
  lessThanMinute: string
  minute: (count: number) => string
  hour: (count: number) => string
  day: (count: number) => string
  month: (count: number) => string
  year: (count: number) => string
}

export function formatInterval(ms: number, labels: IntervalLabels): string {
  if (ms < 60_000) return labels.lessThanMinute
  const minutes = ms / 60_000
  if (minutes < 60) return labels.minute(Math.round(minutes))
  const hours = ms / 3_600_000
  if (hours < 24) return labels.hour(Math.round(hours))
  const days = ms / 86_400_000
  if (days < 30) return labels.day(Math.round(days))
  if (days < 365) return labels.month(Math.round(days / 30))
  return labels.year(Math.round(days / 365))
}

interface Props {
  open: boolean
  onClose: () => void
}

function ReviewRelationRow({
  type,
  text,
  incoming,
}: {
  type: RelationTypeName
  text: string | undefined
  incoming: boolean
}) {
  const t = useT()
  const C = RELATION_CATEGORY_COLORS[RELATION_TYPES[type].cat]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 'var(--space-6)',
        padding: '5px 0',
        ...(incoming && { opacity: 0.7 }),
      }}
    >
      <span
        style={{
          fontSize: '10.5px',
          fontWeight: 500,
          fontFamily: 'var(--font-mono)',
          color: C.color,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          minWidth: 88,
        }}
      >
        {incoming ? '← ' : ''}
        {t.relationTypes.types[type]}
      </span>
      <span
        style={{
          fontSize: '14.5px',
          fontWeight: 500,
          fontFamily: 'var(--font-display)',
          color: 'var(--ink)',
        }}
      >
        {text}
      </span>
    </div>
  )
}

const EMPTY_NODES: ReturnType<typeof sortedDueConceptNodes> = []
const EMPTY_EDGES: never[] = []

export function ReviewMode({ open, onClose }: Props) {
  const t = useT()
  // Gate on `open`: the component stays mounted, and subscribing to the arrays
  // while closed would re-render it (and re-sort the due queue) on every edit.
  const nodes = useGraphStore((s) => (open ? s.nodes : null)) ?? EMPTY_NODES
  const edges = useGraphStore((s) => (open ? s.edges : null)) ?? EMPTY_EDGES
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const saveCurrentGraph = useGraphStore((s) => s.saveCurrentGraph)
  const settings = useGraphStore((s) => s.settings)
  const [revealed, setRevealed] = useState(false)
  /** Cards finished this session; idx resets to 0 after each rating so we track progress separately. */
  const [sessionProgress, setSessionProgress] = useState(0)
  const sessionTotalRef = useRef(0)
  const ratedCardsCountRef = useRef(0)
  const completedRef = useRef(false)

  const scheduler = useMemo(
    () =>
      fsrs({
        request_retention: settings.fsrsRetention,
        maximum_interval: settings.maximumInterval,
      }),
    [settings.fsrsRetention, settings.maximumInterval],
  )

  const due = useMemo(() => sortedDueConceptNodes(nodes), [nodes])

  useLayoutEffect(() => {
    if (open) {
      sessionTotalRef.current = sortedDueConceptNodes(useGraphStore.getState().nodes).length
      ratedCardsCountRef.current = 0
      completedRef.current = false
      setSessionProgress(0)
      setRevealed(false)
    } else {
      sessionTotalRef.current = 0
    }
  }, [open])

  // Flush ratings to the review store the moment the session closes, so FSRS
  // state isn't lost if the user reloads or switches graph inside the autosave
  // debounce window (saveCurrentGraph is a no-op when nothing is dirty).
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !open) {
      void saveCurrentGraph()
      if (!completedRef.current) {
        track({
          name: 'review_session_abandoned',
          props: { rated_cards_bucket: toCountBucket(ratedCardsCountRef.current) },
        })
      }
    }
    wasOpen.current = open
  }, [open, saveCurrentGraph])

  // Rated cards get a future due date and drop out of `due`, so the head of
  // the queue always advances after each rating.
  const currentNode = due[0] ?? null

  const predictedIntervals = useMemo(() => {
    if (!currentNode) return null
    const card = nodeToCard(currentNode.data)
    const now = new Date()
    return Object.fromEntries(
      RATINGS.map((r) => {
        const ms = scheduler.next(card, now, r as Grade).card.due.getTime() - now.getTime()
        return [r, formatInterval(ms, t.review.interval)]
      }),
    ) as Record<(typeof RATINGS)[number], string>
  }, [currentNode, scheduler, t.review.interval])

  if (!open) return null

  const advance = (rating: Rating) => {
    const current = due[0]

    if (current) {
      const now = new Date()
      const { card } = scheduler.next(nodeToCard(current.data), now, rating as Grade)
      updateNodeData(current.id, {
        stability: card.stability,
        difficulty: card.difficulty,
        reps: card.reps,
        lapses: card.lapses,
        fsrsState: card.state,
        due: card.due.getTime(),
        lastReview: now.getTime(),
        lastRating: rating,
        learningSteps: card.learning_steps,
      })
      track({
        name: 'review_card_rated',
        props: { rating: RATING_EVENT_NAMES[rating as (typeof RATINGS)[number]] },
      })
      ratedCardsCountRef.current += 1
    }
    setRevealed(false)

    const queueAfter = sortedDueConceptNodes(useGraphStore.getState().nodes)

    if (queueAfter.length === 0) {
      completedRef.current = true
      track({
        name: 'review_session_completed',
        props: { rated_cards_bucket: toCountBucket(ratedCardsCountRef.current) },
      })
      onClose()
      return
    }

    setSessionProgress((p) => {
      const next = p + 1
      const total = sessionTotalRef.current
      if (next < total) return next

      sessionTotalRef.current = queueAfter.length
      return 0
    })
  }

  if (!due.length) {
    return (
      <ReviewOverlay onClose={onClose}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--cat-temporal)',
          }}
        >
          {t.review.allCaughtUp}
        </div>
        <h2
          style={{
            margin: '14px 0 8px',
            fontSize: '32px',
            fontWeight: 500,
            lineHeight: 1.15,
            fontFamily: 'var(--font-display)',
          }}
        >
          {t.review.nothingDue}
        </h2>
        <p
          style={{
            fontSize: '14.5px',
            fontWeight: 400,
            lineHeight: 1.55,
            fontFamily: 'var(--font-display)',
            color: 'var(--ink-3)',
            margin: '0 0 22px',
          }}
        >
          {t.review.nothingDueDesc}
        </p>
        <Btn primary onClick={onClose}>
          {t.review.close}
        </Btn>
      </ReviewOverlay>
    )
  }

  const node = currentNode!
  const nodeEdges = {
    out: edges.filter((e) => e.source === node.id),
    inc: edges.filter((e) => e.target === node.id),
  }

  const elab = node.data.elaboration
  const hasDef = !!elab?.definition?.trim()

  const sessionTotal = sessionTotalRef.current || due.length
  const sessionPosition = sessionProgress + 1
  const pct = Math.min(100, sessionTotal > 0 ? (sessionProgress / sessionTotal) * 100 : 0)

  const ratingLabels: Record<(typeof RATINGS)[number], string> = {
    [Rating.Again]: t.review.ratings.again,
    [Rating.Hard]: t.review.ratings.hard,
    [Rating.Good]: t.review.ratings.good,
    [Rating.Easy]: t.review.ratings.easy,
  }

  return (
    <ReviewKeyHandler
      open={open}
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      onRate={advance}
      ratings={RATINGS}
    >
      <ReviewOverlay onClose={onClose}>
        {/* Progress bar + counter + close */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', marginBottom: 22 }}
        >
          <div
            style={{
              flex: 1,
              height: 3,
              borderRadius: 'var(--radius-pill)',
              background: 'var(--paper-deep)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: 'var(--highlight)',
                transition: 'width 200ms ease',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              minWidth: 52,
              textAlign: 'right',
            }}
          >
            {sessionPosition} / {sessionTotal}
          </span>
          <CloseButton large onClick={onClose} />
        </div>

        {/* Concept title */}
        <div
          style={{
            marginBottom: 14,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '32px',
              fontWeight: 500,
              lineHeight: 1.12,
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.015em',
              color: 'var(--ink)',
            }}
          >
            {node.data.text}
          </h2>
        </div>

        {!revealed ? (
          <>
            <p
              style={{
                margin: '0 0 22px',
                fontSize: '14.5px',
                fontWeight: 400,
                lineHeight: 1.55,
                fontFamily: 'var(--font-display)',
                color: 'var(--ink-3)',
                fontStyle: 'italic',
              }}
            >
              {t.review.recallPrompt}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
              <Btn primary onClick={() => setRevealed(true)}>
                {t.review.reveal}
              </Btn>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 400,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink-4)',
                }}
              >
                or press Space
              </span>
            </div>
          </>
        ) : (
          <>
            {/* Definition */}
            {hasDef && (
              <div
                style={{
                  marginBottom: 14,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '14.5px',
                    fontWeight: 400,
                    lineHeight: 1.55,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--ink-2)',
                  }}
                >
                  {elab!.definition}
                </p>
              </div>
            )}

            {/* Relations */}
            <div
              style={{
                borderTop: '0.5px dashed var(--line)',
                paddingTop: 12,
                marginBottom: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              {nodeEdges.out.map((e) => (
                <ReviewRelationRow
                  key={e.id}
                  type={e.data?.type as RelationTypeName}
                  text={nodes.find((n) => n.id === e.target)?.data.text}
                  incoming={false}
                />
              ))}
              {nodeEdges.inc.map((e) => (
                <ReviewRelationRow
                  key={e.id}
                  type={e.data?.type as RelationTypeName}
                  text={nodes.find((n) => n.id === e.source)?.data.text}
                  incoming
                />
              ))}
            </div>

            {/* Rating buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              {RATINGS.map((r) => (
                <RatingBtn
                  key={r}
                  label={ratingLabels[r]}
                  interval={predictedIntervals?.[r] ?? ''}
                  color={ratingColor(r)}
                  onClick={() => advance(r)}
                />
              ))}
            </div>
          </>
        )}

        {/* Footer keyboard hint */}
        <div
          style={{
            marginTop: 22,
            paddingTop: 14,
            borderTop: '0.5px dashed var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            fontWeight: 400,
            fontFamily: 'var(--font-sans)',
            color: 'var(--ink-4)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {revealed ? (
              <>
                {['1', '2', '3', '4'].map((k) => (
                  <kbd key={k} style={hintKbd}>
                    {k}
                  </kbd>
                ))}
                <span style={{ marginLeft: 2 }}>rate</span>
              </>
            ) : (
              <>
                <kbd style={hintKbd}>Space</kbd>
                <span>reveal</span>
              </>
            )}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <kbd style={hintKbd}>Esc</kbd>
            <span>close</span>
          </span>
        </div>
      </ReviewOverlay>
    </ReviewKeyHandler>
  )
}

function ReviewKeyHandler({
  open,
  revealed,
  onReveal,
  onRate,
  ratings,
  children,
}: {
  open: boolean
  revealed: boolean
  onReveal: () => void
  onRate: (r: Rating) => void
  ratings: readonly Rating[]
  children: React.ReactNode
}) {
  const revealedRef = useRef(revealed)
  revealedRef.current = revealed
  const onRateRef = useRef(onRate)
  onRateRef.current = onRate
  const onRevealRef = useRef(onReveal)
  onRevealRef.current = onReveal

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (isTextControlFocused()) return
      if (!revealedRef.current && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        onRevealRef.current()
        return
      }
      if (revealedRef.current) {
        const num = parseInt(e.key, 10)
        if (num >= 1 && num <= ratings.length) {
          e.preventDefault()
          onRateRef.current(ratings[num - 1])
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, ratings])

  return <>{children}</>
}

const reviewCardStyle: CSSProperties = {
  width: 560,
  maxWidth: '92vw',
  maxHeight: 'calc(90vh - 40px)',
  overflowY: 'auto',
  background: 'var(--bg-card)',
  border: '0.5px solid var(--line)',
  borderRadius: 'var(--radius-lg)',
  padding: '28px 32px 22px',
  boxShadow: 'var(--shadow-lg)',
}

function ReviewOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <ModalOverlay open onClose={onClose} zIndex={70}>
      <div style={reviewCardStyle}>{children}</div>
    </ModalOverlay>
  )
}

function Btn({
  children,
  primary,
  onClick,
}: {
  children: React.ReactNode
  primary?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none',
        border: primary ? 0 : '0.5px solid var(--line)',
        background: primary ? 'var(--ink-2)' : 'transparent',
        color: primary ? 'var(--paper)' : 'var(--ink-2)',
        fontSize: '12.5px',
        fontWeight: 500,
        fontFamily: 'var(--font-sans)',
        padding: '9px 16px',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function RatingBtn({
  label,
  interval,
  color,
  onClick,
}: {
  label: string
  interval: string
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        appearance: 'none',
        border: 0,
        cursor: 'pointer',
        background: color,
        borderRadius: 'var(--radius-md)',
        padding: '11px 12px 10px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 'var(--space-1)',
      }}
    >
      <span
        style={{
          fontSize: '13px',
          fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          color: 'var(--paper)',
          lineHeight: 1.1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '10.5px',
          fontWeight: 500,
          fontFamily: 'var(--font-mono)',
          color: 'rgba(244,237,225,0.82)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          lineHeight: 1.1,
        }}
      >
        {interval}
      </span>
    </button>
  )
}

const hintKbd: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 500,
  fontFamily: 'var(--font-mono)',
  color: 'var(--ink-3)',
  background: 'var(--paper-deep)',
  border: '0.5px solid var(--line)',
  padding: '1px 5px',
  borderRadius: 'var(--radius-sm)',
}
