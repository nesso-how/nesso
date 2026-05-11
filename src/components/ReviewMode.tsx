// SPDX-License-Identifier: MIT
import { useState, useMemo, useLayoutEffect, useRef, useEffect } from 'react'
import { fsrs, Rating, type Grade } from 'ts-fsrs'
import { EDGE_TYPES, EDGE_CATEGORIES } from '@/data/edgeTypes'
import { sortedDueConceptNodes } from '@/data/fsrsDueQueue'
import { useGraphStore } from '@/store/graph'
import { nodeToCard, type EdgeTypeName } from '@/types/graph'
import { fetchCompletion, isAiReady } from '@/llm/completion'
import { useWebLLM } from '@/llm/webllm'

const REVIEW_QUESTION_SYSTEM =
  'You are a Socratic tutor. Given a concept from a knowledge graph and its semantic connections, write one concise question that tests the learner\'s relational understanding. Output only the question, nothing else. No preamble, no asterisks, no markdown.'

const REVIEW_ANSWER_SYSTEM =
  'You are a Socratic tutor. A learner just reviewed a concept. Provide a concise, direct answer to the question you asked, explaining the key insight from the graph relations. Under 80 words. No emojis, no asterisks, no markdown.'

const RATINGS = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const
const RATING_LABEL: Record<(typeof RATINGS)[number], string> = {
  [Rating.Again]: 'Again',
  [Rating.Hard]: 'Hard',
  [Rating.Good]: 'Good',
  [Rating.Easy]: 'Easy',
}

interface Props {
  open: boolean
  onClose: () => void
}

export function ReviewMode({ open, onClose }: Props) {
  const { nodes, edges, updateNodeData, settings } = useGraphStore()
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  /** Cards finished this session; idx resets to 0 after each rating so we track progress separately. */
  const [sessionProgress, setSessionProgress] = useState(0)
  const sessionTotalRef = useRef(0)
  const [question, setQuestion] = useState<string | null>(null)
  const [questionLoading, setQuestionLoading] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [answerLoading, setAnswerLoading] = useState(false)
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
    setAnswer(null)
    setAnswerLoading(false)

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
      try {
        const q = await fetchCompletion(
          settings,
          [{ role: 'system', content: REVIEW_QUESTION_SYSTEM }, { role: 'user', content: userMsg }],
          80,
          controller.signal,
        )
        if (controller.signal.aborted) return
        setQuestion(q.trim())
        setQuestionLoading(false)

        setAnswerLoading(true)
        const a = await fetchCompletion(
          settings,
          [
            { role: 'system', content: REVIEW_ANSWER_SYSTEM },
            { role: 'user', content: `${userMsg}\nQuestion asked: "${q.trim()}"` },
          ],
          150,
          controller.signal,
        )
        if (controller.signal.aborted) return
        setAnswer(a.trim())
        setAnswerLoading(false)
      } catch {
        if (!controller.signal.aborted) {
          setQuestion(null)
          setQuestionLoading(false)
          setAnswer(null)
          setAnswerLoading(false)
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
          Review · all caught up
        </div>
        <h2 style={{ margin: '12px 0 8px', font: "500 32px/1.15 'Fraunces', serif" }}>
          Nothing due.
        </h2>
        <p style={{ font: "400 15px/1.5 'Fraunces', serif", color: 'var(--ink-2)' }}>
          Come back when cards are due, or pick a concept from the graph.
        </p>
        <Btn primary onClick={onClose}>Close</Btn>
      </Overlay>
    )
  }

  const node = currentNode!
  const nodeEdges = {
    out: edges.filter(e => e.source === node.id),
    inc: edges.filter(e => e.target === node.id),
  }

  const sessionTotal = sessionTotalRef.current || due.length
  const sessionPosition = sessionProgress + 1

  return (
    <Overlay onClose={onClose}>
      <div style={{ font: "500 11px 'JetBrains Mono', ui-monospace", textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cat-causal)' }}>
        Review · {sessionPosition} of {sessionTotal}
      </div>
      <h2 style={{ margin: '16px 0 6px', font: "500 44px/1.05 'Fraunces', serif", letterSpacing: '-0.02em' }}>
        {node.data.text}
      </h2>
      <div style={{ marginBottom: 18, minHeight: 24 }}>
        {questionLoading ? (
          <span style={{ color: 'var(--ink-4)', font: "400 12px 'JetBrains Mono', ui-monospace" }}>Generating question…</span>
        ) : question ? (
          <span style={{ font: "400 15px/1.5 'Fraunces', serif", color: 'var(--ink-2)' }}>{question}</span>
        ) : (
          <span style={{ font: "400 13px/1.4 'Fraunces', serif", fontStyle: 'italic', color: 'var(--ink-3)' }}>Recall its relations before revealing.</span>
        )}
      </div>

      {!revealed ? (
        <Btn primary onClick={() => setRevealed(true)}>Reveal</Btn>
      ) : (
        <>
          <div style={{ borderTop: '0.5px dashed var(--line)', paddingTop: 14, marginBottom: 18 }}>
            {nodeEdges.out.map(e => {
              const T = EDGE_TYPES[e.data?.type as EdgeTypeName]
              const C = EDGE_CATEGORIES[T.cat]
              const target = nodes.find(n => n.id === e.target)
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <span style={{ font: "500 11px 'JetBrains Mono', ui-monospace", color: C.color, minWidth: 110 }}>{T.label}</span>
                  <span style={{ font: "400 14px 'Fraunces', serif" }}>{target?.data.text}</span>
                </div>
              )
            })}
            {nodeEdges.inc.map(e => {
              const T = EDGE_TYPES[e.data?.type as EdgeTypeName]
              const C = EDGE_CATEGORIES[T.cat]
              const source = nodes.find(n => n.id === e.source)
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, opacity: 0.7 }}>
                  <span style={{ font: "500 11px 'JetBrains Mono', ui-monospace", color: C.color, minWidth: 110 }}>← {T.label}</span>
                  <span style={{ font: "400 14px 'Fraunces', serif" }}>{source?.data.text}</span>
                </div>
              )
            })}
          </div>

          {(answer || answerLoading) && (
            <div style={{ borderTop: '0.5px dashed var(--line)', paddingTop: 12, marginBottom: 18 }}>
              {answerLoading ? (
                <span style={{ font: "400 12px 'JetBrains Mono', ui-monospace", color: 'var(--ink-4)' }}>…</span>
              ) : (
                <p style={{ font: "400 14px/1.55 'Fraunces', serif", color: 'var(--ink-2)', margin: 0 }}>{answer}</p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            {RATINGS.map(r => (
              <button key={r} onClick={() => advance(r)} style={{
                flex: 1,
                appearance: 'none',
                border: '0.5px solid var(--line)',
                background: `var(--conf-${r})`,
                color: 'var(--paper)',
                font: "600 11px 'JetBrains Mono', ui-monospace",
                padding: 10,
                borderRadius: 8,
                cursor: 'default',
              }}>
                {RATING_LABEL[r]}
              </button>
            ))}
          </div>
        </>
      )}
    </Overlay>
  )
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
        width: 520, maxWidth: '92vw',
        background: 'var(--bg-card)',
        border: '0.5px solid var(--line)',
        borderRadius: 18,
        padding: '32px 36px 28px',
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
      background: primary ? 'var(--ink)' : 'transparent',
      color: primary ? 'var(--paper)' : 'var(--ink-2)',
      font: "500 12px 'JetBrains Mono', ui-monospace",
      padding: '8px 16px',
      borderRadius: 999,
      cursor: 'default',
    }}>
      {children}
    </button>
  )
}
