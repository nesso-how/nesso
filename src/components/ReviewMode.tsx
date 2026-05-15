// SPDX-License-Identifier: MIT
import { useState, useMemo, useLayoutEffect, useRef, useEffect } from 'react'
import { fsrs, Rating, type Grade } from 'ts-fsrs'
import { EDGE_TYPES, EDGE_CATEGORIES } from '@/data/edgeTypes'
import { sortedDueConceptNodes } from '@/data/fsrsDueQueue'
import { useGraphStore } from '@/store/graph'
import { nodeToCard, type EdgeTypeName } from '@/types/graph'
import { fetchCompletion, isAiReady } from '@/llm/completion'
import { useWebLLM } from '@/llm/webllm'
import { useT } from '@/i18n'
import { CloseButton } from './CloseButton'
import { ThinkingIndicator } from './ThinkingIndicator'
import { Typewriter } from './Typewriter'

const REVIEW_QUESTION_SYSTEM =
  'You are a Socratic tutor. Given a concept from a knowledge graph and its semantic connections, write one concise question that tests the learner\'s relational understanding. Output only the question, nothing else. No preamble, no asterisks, no markdown.'

const RATINGS = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const

function formatInterval(ms: number): string {
  if (ms < 60_000) return '< 1m'
  const days = ms / 86_400_000
  if (days < 1) return '< 1d'
  if (days < 30) return `${Math.round(days)}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${Math.round(days / 365)}y`
}

interface Props {
  open: boolean
  onClose: () => void
}

export function ReviewMode({ open, onClose }: Props) {
  const t = useT()
  const { nodes, edges, updateNodeData, settings } = useGraphStore()
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  /** Cards finished this session; idx resets to 0 after each rating so we track progress separately. */
  const [sessionProgress, setSessionProgress] = useState(0)
  const sessionTotalRef = useRef(0)
  const [question, setQuestion] = useState<string | null>(null)
  const [questionLoading, setQuestionLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const webllm = useWebLLM()

  const scheduler = useMemo(
    () => fsrs({ request_retention: settings.fsrsRetention, maximum_interval: settings.maximumInterval }),
    [settings.fsrsRetention, settings.maximumInterval],
  )

  const due = useMemo(
    () => sortedDueConceptNodes(nodes),
    [nodes],
  )

  useLayoutEffect(() => {
    if (open) {
      sessionTotalRef.current = sortedDueConceptNodes(useGraphStore.getState().nodes).length
      setSessionProgress(0)
      setIdx(0)
      setRevealed(false)
    } else {
      sessionTotalRef.current = 0
      abortRef.current?.abort()
    }
  }, [open])

  const currentNode = due.length ? due[idx % due.length] : null
  const aiReady = settings.aiMode === 'local' ? webllm.status === 'ready' : isAiReady(settings)

  const predictedIntervals = useMemo(() => {
    if (!currentNode) return null
    const card = nodeToCard(currentNode.data)
    const now = new Date()
    return Object.fromEntries(
      RATINGS.map(r => {
        const ms = scheduler.next(card, now, r as Grade).card.due.getTime() - now.getTime()
        return [r, formatInterval(ms)]
      }),
    ) as Record<(typeof RATINGS)[number], string>
  }, [currentNode, scheduler])

  useEffect(() => {
    if (!open || !currentNode || !aiReady) {
      setQuestion(null)
      setQuestionLoading(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setQuestion(null)
    setQuestionLoading(true)

    const outEdges = edges.filter(e => e.source === currentNode.id).slice(0, 5)
    const incEdges = edges.filter(e => e.target === currentNode.id).slice(0, 3)
    const relStr = [
      ...outEdges.map(e => {
        const T = EDGE_TYPES[e.data?.type as EdgeTypeName]
        const target = nodes.find(n => n.id === e.target)
        return `${T.label} → "${target?.data.text ?? '?'}"`
      }),
      ...incEdges.map(e => {
        const T = EDGE_TYPES[e.data?.type as EdgeTypeName]
        const source = nodes.find(n => n.id === e.source)
        return `← ${T.label} ← "${source?.data.text ?? '?'}"`
      }),
    ].join('; ')

    const userMsg = relStr
      ? `Concept: "${currentNode.data.text}"\nRelations: ${relStr}`
      : `Concept: "${currentNode.data.text}"`

    const run = async () => {
      const langSuffix = settings.language === 'it' ? ' Respond in Italian.' : ''
      try {
        const q = await fetchCompletion(
          settings,
          [{ role: 'system', content: REVIEW_QUESTION_SYSTEM + langSuffix }, { role: 'user', content: userMsg }],
          80,
          controller.signal,
        )
        if (controller.signal.aborted) return
        setQuestion(q.trim())
        setQuestionLoading(false)
      } catch {
        if (!controller.signal.aborted) {
          setQuestion(null)
          setQuestionLoading(false)
        }
      }
    }
    void run()

    return () => controller.abort()
  }, [open, currentNode?.id, aiReady]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  const advance = (rating: Rating) => {
    const current = due[idx]

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
      })
    }
    setRevealed(false)

    const queueAfter = sortedDueConceptNodes(useGraphStore.getState().nodes)

    if (queueAfter.length === 0) {
      onClose()
      return
    }

    setSessionProgress(p => {
      const next = p + 1
      const total = sessionTotalRef.current
      if (next < total) return next

      sessionTotalRef.current = queueAfter.length
      return 0
    })

    setIdx(0)
  }

  if (!due.length) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ font: "500 11px 'JetBrains Mono', ui-monospace", textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cat-temporal)' }}>
          {t.review.allCaughtUp}
        </div>
        <h2 style={{ margin: '14px 0 8px', font: "500 32px/1.15 'Fraunces', serif" }}>
          {t.review.nothingDue}
        </h2>
        <p style={{ font: "400 14.5px/1.55 'Fraunces', serif", color: 'var(--ink-3)', margin: '0 0 22px' }}>
          {t.review.nothingDueDesc}
        </p>
        <Btn primary onClick={onClose}>{t.review.close}</Btn>
      </Overlay>
    )
  }

  const node = currentNode!
  const nodeEdges = {
    out: edges.filter(e => e.source === node.id),
    inc: edges.filter(e => e.target === node.id),
  }

  const elab = node.data.elaboration
  const examplesArr = (elab?.examples ?? '').split('\n').filter(s => s.length > 0)
  const hasImage = !!elab?.imageUrl
  const hasDef = !!(elab?.definition?.trim())
  const hasExamples = examplesArr.length > 0

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
    <ReviewKeyHandler open={open} revealed={revealed} onReveal={() => setRevealed(true)} onRate={advance} ratings={RATINGS}>
      <Overlay onClose={onClose}>
        {/* Progress bar + counter + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 999, background: 'var(--paper-deep)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--cat-causal)', transition: 'width 200ms ease' }} />
          </div>
          <span style={{
            font: "500 10.5px 'JetBrains Mono', ui-monospace",
            color: 'var(--ink-4)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            minWidth: 52, textAlign: 'right',
          }}>
            {sessionPosition} / {sessionTotal}
          </span>
          <CloseButton large onClick={onClose} />
        </div>

        {/* Concept title + image (image only after reveal) */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          {revealed && hasImage && (
            <img
              src={elab!.imageUrl}
              alt={node.data.text}
              style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10, border: '0.5px solid var(--line)', flexShrink: 0 }}
            />
          )}
          <h2 style={{ margin: 0, font: "500 32px/1.12 'Fraunces', serif", letterSpacing: '-0.015em', color: 'var(--ink)' }}>
            {node.data.text}
          </h2>
        </div>

        {!revealed ? (
          <>
            <div style={{ marginBottom: 22, minHeight: 44, display: 'flex', alignItems: 'center' }}>
              {questionLoading ? (
                <ThinkingIndicator />
              ) : question ? (
                <span style={{ font: "400 14.5px/1.55 'Fraunces', serif", color: 'var(--ink-2)' }}>
                  <Typewriter text={question} />
                </span>
              ) : (
                <p style={{ margin: 0, font: "400 14.5px/1.55 'Fraunces', serif", color: 'var(--ink-3)', fontStyle: 'italic' }}>
                  {t.review.recallPrompt}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Btn primary onClick={() => setRevealed(true)}>{t.review.reveal}</Btn>
              <span style={{ font: "400 12px 'Inter'", color: 'var(--ink-4)' }}>or press Space</span>
            </div>
          </>
        ) : (
          <>
            {/* Definition / Examples */}
            {(hasDef || hasExamples) && (
              <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {hasDef && (
                  <p style={{ margin: 0, font: "400 14.5px/1.55 'Fraunces', serif", color: 'var(--ink-2)' }}>
                    {elab!.definition}
                  </p>
                )}
                {hasExamples && (
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {examplesArr.map((ex, i) => (
                      <li key={i} style={{ font: "400 14.5px/1.55 'Fraunces', serif", color: 'var(--ink-2)' }}>{ex}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Relations */}
            <div style={{ borderTop: '0.5px dashed var(--line)', paddingTop: 12, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {nodeEdges.out.map(e => {
                const T = EDGE_TYPES[e.data?.type as EdgeTypeName]
                const C = EDGE_CATEGORIES[T.cat]
                const target = nodes.find(n => n.id === e.target)
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '5px 0' }}>
                    <span style={{ font: "500 10.5px 'JetBrains Mono', ui-monospace", color: C.color, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 88 }}>{t.edgeTypes.types[e.data?.type as EdgeTypeName]}</span>
                    <span style={{ font: "500 14.5px 'Fraunces', serif", color: 'var(--ink)' }}>{target?.data.text}</span>
                  </div>
                )
              })}
              {nodeEdges.inc.map(e => {
                const T = EDGE_TYPES[e.data?.type as EdgeTypeName]
                const C = EDGE_CATEGORIES[T.cat]
                const source = nodes.find(n => n.id === e.source)
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '5px 0', opacity: 0.7 }}>
                    <span style={{ font: "500 10.5px 'JetBrains Mono', ui-monospace", color: C.color, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 88 }}>← {t.edgeTypes.types[e.data?.type as EdgeTypeName]}</span>
                    <span style={{ font: "500 14.5px 'Fraunces', serif", color: 'var(--ink)' }}>{source?.data.text}</span>
                  </div>
                )
              })}
            </div>

            {/* Rating buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              {RATINGS.map(r => (
                <RatingBtn
                  key={r}
                  label={ratingLabels[r]}
                  interval={predictedIntervals?.[r] ?? ''}
                  color={`var(--conf-${r})`}
                  onClick={() => advance(r)}
                />
              ))}
            </div>
          </>
        )}

        {/* Footer keyboard hint */}
        <div style={{
          marginTop: 22, paddingTop: 14,
          borderTop: '0.5px dashed var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          font: "400 11px 'Inter'", color: 'var(--ink-4)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {revealed ? (
              <>
                {['1', '2', '3', '4'].map(k => <kbd key={k} style={hintKbd}>{k}</kbd>)}
                <span style={{ marginLeft: 2 }}>rate</span>
              </>
            ) : (
              <>
                <kbd style={hintKbd}>Space</kbd>
                <span>reveal</span>
              </>
            )}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <kbd style={hintKbd}>Esc</kbd>
            <span>close</span>
          </span>
        </div>
      </Overlay>
    </ReviewKeyHandler>
  )
}

function ReviewKeyHandler({
  open, revealed, onReveal, onRate, ratings, children,
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
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

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 70,
        background: 'rgba(20, 18, 14, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: '92vw',
        maxHeight: 'calc(90vh - 40px)',
        overflowY: 'auto',
        background: 'var(--bg-card)',
        border: '0.5px solid var(--line)',
        borderRadius: 18,
        padding: '28px 32px 22px',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {children}
      </div>
    </div>
  )
}

function Btn({ children, primary, onClick }: { children: React.ReactNode; primary?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      appearance: 'none',
      border: primary ? 0 : '0.5px solid var(--line)',
      background: primary ? 'var(--accent)' : 'transparent',
      color: primary ? 'var(--paper)' : 'var(--ink-2)',
      font: "500 12.5px 'Inter'",
      padding: '9px 16px',
      borderRadius: 999,
      cursor: 'default',
    }}>
      {children}
    </button>
  )
}

function RatingBtn({ label, interval, color, onClick }: {
  label: string
  interval: string
  color: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1,
      appearance: 'none', border: 0, cursor: 'default',
      background: color,
      borderRadius: 10,
      padding: '11px 12px 10px',
      display: 'flex', flexDirection: 'column',
      alignItems: 'flex-start', gap: 2,
    }}>
      <span style={{ font: "500 13px 'Inter'", color: 'var(--paper)', lineHeight: 1.1 }}>{label}</span>
      <span style={{
        font: "500 10.5px 'JetBrains Mono', ui-monospace",
        color: 'rgba(244,237,225,0.82)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        lineHeight: 1.1,
      }}>{interval}</span>
    </button>
  )
}

const hintKbd: React.CSSProperties = {
  font: "500 10px 'JetBrains Mono', ui-monospace",
  color: 'var(--ink-3)',
  background: 'var(--paper-deep)',
  border: '0.5px solid var(--line)',
  padding: '1px 5px',
  borderRadius: 4,
}
