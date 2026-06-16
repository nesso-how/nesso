// SPDX-License-Identifier: MIT
import { useState, useMemo, useLayoutEffect, useRef, useEffect, type CSSProperties } from 'react'
import { fsrs, Rating, type Grade } from 'ts-fsrs'
import { RELATION_TYPES, RELATION_CATEGORIES } from '@/data/relationTypes'
import { sortedDueConceptNodes } from '@/data/fsrsDueQueue'
import { useGraphStore } from '@/store'
import { nodeToCard, type EdgeTypeName } from '@/types/graph'
import { buildReviewElaborationPrompt } from '@/llm/context'
import { fetchCompletion, isAiReady } from '@/llm/completion'
import { ratingColor } from '@nesso-how/graph'
import { SocratesGlyph } from '@/components/mentor/SocratesGlyph'
import { useWebLLM } from '@/llm/webllm'
import { useT } from '@/i18n'
import { CloseButton } from '@/components/ui/CloseButton'
import { ModalOverlay } from '@/components/ui/ModalOverlay'
import { ThinkingIndicator } from '@/components/mentor/ThinkingIndicator'
import { Typewriter } from '@/components/mentor/Typewriter'

const REVIEW_QUESTION_SYSTEM =
  'You are a Socratic tutor. Given a concept from a knowledge graph, optional learner notes (definition, examples, notes), and its semantic connections, write one concise question that tests understanding. Use the notes only to aim the question (topic, pitfall, application), without quoting or paraphrasing the definition so the learner can still actively recall. If notes are missing, rely on the title and relations. Output only the question, nothing else. No preamble, no asterisks, no markdown.'

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

const EMPTY_NODES: ReturnType<typeof sortedDueConceptNodes> = []
const EMPTY_EDGES: never[] = []

export function ReviewMode({ open, onClose }: Props) {
  const t = useT()
  // Gate on `open`: the component stays mounted, and subscribing to the arrays
  // while closed would re-render it (and re-sort the due queue) on every edit.
  const nodes = useGraphStore((s) => (open ? s.nodes : null)) ?? EMPTY_NODES
  const edges = useGraphStore((s) => (open ? s.edges : null)) ?? EMPTY_EDGES
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const settings = useGraphStore((s) => s.settings)
  const [revealed, setRevealed] = useState(false)
  /** Cards finished this session; idx resets to 0 after each rating so we track progress separately. */
  const [sessionProgress, setSessionProgress] = useState(0)
  const sessionTotalRef = useRef(0)
  const [question, setQuestion] = useState<string | null>(null)
  const [questionLoading, setQuestionLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const webllm = useWebLLM()

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
      setSessionProgress(0)
      setRevealed(false)
    } else {
      sessionTotalRef.current = 0
      abortRef.current?.abort()
    }
  }, [open])

  // Rated cards get a future due date and drop out of `due`, so the head of
  // the queue always advances after each rating.
  const currentNode = due[0] ?? null
  const aiReady = settings.aiMode === 'local' ? webllm.status === 'ready' : isAiReady(settings)

  const predictedIntervals = useMemo(() => {
    if (!currentNode) return null
    const card = nodeToCard(currentNode.data)
    const now = new Date()
    return Object.fromEntries(
      RATINGS.map((r) => {
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

    const outEdges = edges.filter((e) => e.source === currentNode.id).slice(0, 5)
    const incEdges = edges.filter((e) => e.target === currentNode.id).slice(0, 3)
    const relStr = [
      ...outEdges.map((e) => {
        const T = RELATION_TYPES[e.data?.type as EdgeTypeName]
        const target = nodes.find((n) => n.id === e.target)
        return `${T.label} → "${target?.data.text ?? '?'}"`
      }),
      ...incEdges.map((e) => {
        const T = RELATION_TYPES[e.data?.type as EdgeTypeName]
        const source = nodes.find((n) => n.id === e.source)
        return `← ${T.label} ← "${source?.data.text ?? '?'}"`
      }),
    ].join('; ')

    const elaboration = buildReviewElaborationPrompt(currentNode)
    const userMsg = [
      `Concept: "${currentNode.data.text}"`,
      elaboration,
      relStr ? `Relations: ${relStr}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const run = async () => {
      const langSuffix = settings.language === 'it' ? ' Respond in Italian.' : ''
      try {
        const q = await fetchCompletion(
          settings,
          [
            { role: 'system', content: REVIEW_QUESTION_SYSTEM + langSuffix },
            { role: 'user', content: userMsg },
          ],
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
    }
    setRevealed(false)

    const queueAfter = sortedDueConceptNodes(useGraphStore.getState().nodes)

    if (queueAfter.length === 0) {
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
  const examplesArr = (elab?.examples ?? '').split('\n').filter((s) => s.length > 0)
  const hasImage = !!elab?.imageUrl
  const hasDef = !!elab?.definition?.trim()
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

        {/* Concept title + image (image only after reveal) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-6)',
            marginBottom: 14,
          }}
        >
          {revealed && hasImage && (
            <img
              src={elab!.imageUrl}
              alt={node.data.text}
              style={{
                width: 56,
                height: 56,
                objectFit: 'cover',
                borderRadius: 'var(--radius-md)',
                border: '0.5px solid var(--line)',
                flexShrink: 0,
              }}
            />
          )}
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
            <div
              style={{
                marginBottom: 22,
                minHeight: 44,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-5)',
              }}
            >
              {questionLoading ? (
                <ThinkingIndicator />
              ) : question ? (
                <>
                  <div
                    style={{
                      flexShrink: 0,
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-circle)',
                      border: '0.5px solid var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <SocratesGlyph size={24} color="var(--ink-3)" />
                  </div>
                  <span
                    style={{
                      fontSize: '14.5px',
                      fontWeight: 400,
                      lineHeight: 1.55,
                      fontFamily: 'var(--font-display)',
                      color: 'var(--ink-2)',
                      paddingTop: 8,
                    }}
                  >
                    <Typewriter text={question} />
                  </span>
                </>
              ) : (
                <p
                  style={{
                    margin: 0,
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
              )}
            </div>
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
            {/* Definition / Examples */}
            {(hasDef || hasExamples) && (
              <div
                style={{
                  marginBottom: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-5)',
                }}
              >
                {hasDef && (
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
                )}
                {hasExamples && (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-1)',
                    }}
                  >
                    {examplesArr.map((ex, i) => (
                      <li
                        key={i}
                        style={{
                          fontSize: '14.5px',
                          fontWeight: 400,
                          lineHeight: 1.55,
                          fontFamily: 'var(--font-display)',
                          color: 'var(--ink-2)',
                        }}
                      >
                        {ex}
                      </li>
                    ))}
                  </ul>
                )}
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
              {nodeEdges.out.map((e) => {
                const T = RELATION_TYPES[e.data?.type as EdgeTypeName]
                const C = RELATION_CATEGORIES[T.cat]
                const target = nodes.find((n) => n.id === e.target)
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 'var(--space-6)',
                      padding: '5px 0',
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
                      {t.relationTypes.types[e.data?.type as EdgeTypeName]}
                    </span>
                    <span
                      style={{
                        fontSize: '14.5px',
                        fontWeight: 500,
                        fontFamily: 'var(--font-display)',
                        color: 'var(--ink)',
                      }}
                    >
                      {target?.data.text}
                    </span>
                  </div>
                )
              })}
              {nodeEdges.inc.map((e) => {
                const T = RELATION_TYPES[e.data?.type as EdgeTypeName]
                const C = RELATION_CATEGORIES[T.cat]
                const source = nodes.find((n) => n.id === e.source)
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 'var(--space-6)',
                      padding: '5px 0',
                      opacity: 0.7,
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
                      ← {t.relationTypes.types[e.data?.type as EdgeTypeName]}
                    </span>
                    <span
                      style={{
                        fontSize: '14.5px',
                        fontWeight: 500,
                        fontFamily: 'var(--font-display)',
                        color: 'var(--ink)',
                      }}
                    >
                      {source?.data.text}
                    </span>
                  </div>
                )
              })}
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
        cursor: 'default',
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
        cursor: 'default',
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
