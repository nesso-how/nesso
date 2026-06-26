// SPDX-License-Identifier: MIT
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { SocratesGlyph } from './SocratesGlyph'
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from '@/store'
import type { ConceptNodeData, Language } from '@/types/graph'
import { fetchCompletion, isAiReady } from '@/llm/completion'
import { buildFocalNeighborContext, nodeStrength, oneHopNeighborIds } from '@/llm/context'
import { useT } from '@/i18n'
import { CloseButton } from '@/components/ui/CloseButton'
import { STATUS_BAR_HEIGHT_PX } from '@/components/layout/StatusBar'
import { ThinkingIndicator } from './ThinkingIndicator'
import { renderWithEmphasis } from './emphasis'
import { track } from '@/telemetry'

interface Message {
  role: 'user' | 'mentor'
  text: string
}

/** Coarse failure category for telemetry: a fetch network/CORS failure throws TypeError; an HTTP error does not. */
function mentorFailureReason(err: unknown): 'network' | 'response' {
  return err instanceof TypeError ? 'network' : 'response'
}

function mentorFailureMessage(err: unknown, t: ReturnType<typeof useT>): string {
  if (err instanceof TypeError) return t.mentor.errorConnection
  return t.mentor.errorRetrySlow
}

function appendToLastMentor(history: Message[], delta: string): Message[] {
  const last = history[history.length - 1]
  if (!last || last.role !== 'mentor') return [...history, { role: 'mentor', text: delta }]
  return [...history.slice(0, -1), { ...last, text: last.text + delta }]
}

function mentorCompletionMessages(systemPrompt: string, msgs: Message[]) {
  return [
    { role: 'system' as const, content: systemPrompt },
    ...msgs.map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    })),
  ]
}

/** Cap snapshot size so the system prompt stays bounded on large graphs. */
const MAX_SNAPSHOT_NODES = 60
/** Linked maps often have more edges than nodes; ~2× node cap keeps structure visible without dumping huge |E|. */
const MAX_SNAPSHOT_EDGES = MAX_SNAPSHOT_NODES * 2
/**
 * Output ceiling, not a target: reply length is soft-capped at ~200 words in
 * getMentorBase. Headroom is generous so reasoning models (e.g. qwen3 thinking
 * mode) can spend tokens on their hidden reasoning and still emit a full answer
 * within the same budget.
 */
const MENTOR_MAX_TOKENS = 2048

const NODE_LEGEND =
  'Reading each node after its quoted title: (new)=no spaced-repetition review yet; otherwise comma-separated tokens — s=Y.Yd is FSRS stability in days (higher = stronger recall); Nd since review is calendar days since the last FSRS self-rating; Again/Hard/Good/Easy is that rating; DUE means the scheduler says revisit now (light hint, secondary to s= and rating).'

function getMentorBase(language: Language): string[] {
  const name = language === 'it' ? 'Socrate' : 'Socrates'
  const langInstruction = language === 'it' ? 'Respond in Italian.' : 'Respond in English.'
  return [
    `You are ${name} in Nesso, an app for building typed knowledge graphs for active learning. Be warm, precise, and Socratic: mostly questions, almost no lecturing.`,
    'Never tell the user what nodes or edges to add or rename. No graph edits; only dialogue about ideas.',
    'No emojis or flattery. Use *asterisks* sparingly for a key term. No JSON, markup pseudo-graphs, or bracketed labels.',
    'Do not use em dashes (the long dash character). Use commas, periods, or split into two short sentences instead.',
    'Default: one short question; explain only to frame the question. Aim under ~180 words.',
    NODE_LEGEND,
    'Lowest s= (stability) plus weak last outcomes (Again/Hard, large gap since review) are the main probes; treat DUE as a light scheduling cue on top.',
    'When a node IS selected on open: briefly acknowledge it by name, then ask one Socratic question about it or flag its weakest neighbors by stability and last review, using DUE only as secondary context.',
    'When an EDGE is selected but no node: name both endpoint concepts and the relation type, then ask one Socratic question about how that link fits what they know.',
    "When neither a node nor an edge is selected on open: pick the graph's weakest spot by stability and last review; consider DUE as extra context, then open with one question there.",
    langInstruction,
  ]
}

const FSRS_RATING: Record<number, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' }

function nodeDesc(n: Node<ConceptNodeData>): string {
  if (n.data.reps === 0) return `"${n.data.text}"(new)`
  const isDue = n.data.due > 0 && n.data.due <= Date.now()
  const parts: string[] = [`s=${n.data.stability.toFixed(1)}d`]
  if (n.data.lastReview > 0) {
    const days = Math.floor((Date.now() - n.data.lastReview) / (24 * 60 * 60 * 1000))
    parts.push(`${Math.max(days, 0)}d since review`)
  }
  if (n.data.lastRating > 0) parts.push(FSRS_RATING[n.data.lastRating] ?? '')
  if (isDue) parts.push('DUE')
  return `"${n.data.text}"(${parts.join(',')})`
}

function buildMentorSeedText(
  language: Language,
  nodes: Node<ConceptNodeData>[],
  selectedNode: Node<ConceptNodeData> | null,
  selectedEdge: Edge | null,
): string {
  const label = (id: string) => nodes.find((n) => n.id === id)?.data.text ?? id
  if (selectedNode) {
    return language === 'it'
      ? `Voglio esplorare il concetto "${selectedNode.data.text}".`
      : `I want to explore the concept "${selectedNode.data.text}".`
  }
  if (selectedEdge) {
    const a = label(selectedEdge.source)
    const b = label(selectedEdge.target)
    const typ = String(selectedEdge.data?.type ?? '?')
    return language === 'it'
      ? `Voglio ragionare sulla relazione "${a}" → ${typ} → "${b}".`
      : `I want to explore the relation "${a}" → ${typ} → "${b}".`
  }
  return language === 'it'
    ? 'Voglio rivedere la mia mappa. Dove dovrei concentrarmi?'
    : 'I want to review my knowledge map. Where should I focus?'
}

function buildGraphChatPrompt(
  nodes: Node<ConceptNodeData>[],
  edges: Edge[],
  selectedNode: Node<ConceptNodeData> | null,
  selectedEdge: Edge | null,
  language: Language,
): string {
  const label = (id: string) => nodes.find((n) => n.id === id)?.data.text ?? id
  const snapEdges = edges.length > MAX_SNAPSHOT_EDGES ? edges.slice(0, MAX_SNAPSHOT_EDGES) : edges
  const edgeOmit =
    edges.length > snapEdges.length
      ? ` … (${edges.length - snapEdges.length} more edges omitted)`
      : ''
  const edgeListBody = snapEdges
    .map((e) => {
      const src = label(e.source)
      const tgt = label(e.target)
      return `${src} → ${String(e.data?.type ?? '?')} → ${tgt}`
    })
    .join('; ')
  const edgeList = edgeListBody ? `${edgeListBody}${edgeOmit}` : ''
  const sortedNodes = [...nodes].sort((a, b) => nodeStrength(a) - nodeStrength(b))
  const snapNodes =
    sortedNodes.length > MAX_SNAPSHOT_NODES ? sortedNodes.slice(0, MAX_SNAPSHOT_NODES) : sortedNodes
  const nodeOmit =
    sortedNodes.length > snapNodes.length
      ? ` … (${sortedNodes.length - snapNodes.length} more nodes omitted)`
      : ''
  const nodeList = snapNodes.map(nodeDesc).join(', ') + nodeOmit || '(no nodes)'
  const selCtx = selectedNode
    ? `Selection: node ${nodeDesc(selectedNode)}.`
    : selectedEdge
      ? `Selection: edge ${label(selectedEdge.source)} → ${String(selectedEdge.data?.type ?? '?')} → ${label(selectedEdge.target)}.`
      : ''
  let focusLine = ''
  let relatedLine = ''
  if (selectedNode) {
    const neighborIds = new Set(oneHopNeighborIds(selectedNode.id, edges))
    const neighbors = nodes.filter((n) => neighborIds.has(n.id))
    const { focus, related } = buildFocalNeighborContext(selectedNode, neighbors)
    if (focus) focusLine = `Focus: ${focus}`
    if (related) relatedLine = `Related: ${related}`
  }
  return [
    ...getMentorBase(language),
    '',
    `Nodes: ${nodeList}`,
    edgeList ? `Edges: ${edgeList}` : '',
    selCtx,
    focusLine,
    relatedLine,
  ]
    .filter(Boolean)
    .join('\n')
}

export function MentorPanel({ leftInset, rightInset }: { leftInset: number; rightInset: number }) {
  const t = useT()
  const mentorPanelExpanded = useGraphStore((s) => s.mentorPanelExpanded)
  const setMentorPanelExpanded = useGraphStore((s) => s.setMentorPanelExpanded)
  const currentGraphId = useGraphStore((s) => s.currentGraphId)
  const settings = useGraphStore((s) => s.settings)
  // Primitive selector for the placeholder only — graph data for prompts is
  // read via getState() at send time, so the panel doesn't re-render on
  // every node drag frame.
  const selectedNodeText = useGraphStore((s) =>
    s.selected?.kind === 'node'
      ? (s.nodes.find((n) => n.id === s.selected!.id)?.data.text ?? null)
      : null,
  )

  const aiReady = isAiReady(settings)

  const [history, setHistory] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(false)
  const [chatKey, setChatKey] = useState(0)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const buildSystemPrompt = useCallback(() => {
    const s = useGraphStore.getState()
    return buildGraphChatPrompt(
      s.nodes,
      s.edges,
      selectedNodeSelector(s),
      selectedEdgeSelector(s),
      s.settings.language,
    )
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: opening line tied to graph open/switch; live sends use fresh prompt via buildSystemPrompt
  useEffect(() => {
    if (!mentorPanelExpanded) return
    if (!aiReady) {
      setHistory([{ role: 'mentor', text: t.mentor.needsSetup }])
      setLoadingInitial(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setHistory([])
    setStreaming(false)
    setLoadingInitial(true)

    const storeState = useGraphStore.getState()
    const systemPrompt = buildSystemPrompt()
    const seedText = buildMentorSeedText(
      settings.language,
      storeState.nodes,
      selectedNodeSelector(storeState),
      selectedEdgeSelector(storeState),
    )

    let started = false
    fetchCompletion(
      settings,
      mentorCompletionMessages(systemPrompt, [{ role: 'user', text: seedText }]),
      MENTOR_MAX_TOKENS,
      controller.signal,
      (delta) => {
        if (controller.signal.aborted) return
        if (!started) {
          started = true
          setLoadingInitial(false)
          setStreaming(true)
          setHistory([{ role: 'mentor', text: delta }])
        } else {
          setHistory((h) => appendToLastMentor(h, delta))
        }
      },
    )
      .then((full) => {
        if (!controller.signal.aborted && !started) {
          setHistory([{ role: 'mentor', text: full || '…' }])
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setHistory([{ role: 'mentor', text: mentorFailureMessage(err, t) }])
          track({ name: 'mentor_request_failed', props: { reason: mentorFailureReason(err) } })
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingInitial(false)
          setStreaming(false)
        }
      })

    return () => controller.abort()
  }, [mentorPanelExpanded, currentGraphId, aiReady, settings.language, chatKey])

  useEffect(() => {
    if (mentorPanelExpanded && inputRef.current) inputRef.current.focus()
  }, [mentorPanelExpanded])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const stickToBottom = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      if (distance < 80) el.scrollTop = el.scrollHeight
    }
    const mo = new MutationObserver(stickToBottom)
    mo.observe(el, { childList: true, subtree: true, characterData: true })
    return () => mo.disconnect()
  }, [])

  const send = async (text: string) => {
    if (!text.trim() || thinking || loadingInitial) return
    // Abortable, and guarded below: a "new chat" or graph switch aborts via
    // abortRef, so a stale reply never lands in the wrong conversation.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const next: Message[] = [...history, { role: 'user', text }]
    setHistory(next)
    setDraft('')
    setThinking(true)
    track({ name: 'mentor_message_sent' })
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
    let started = false
    try {
      const full = await fetchCompletion(
        settings,
        mentorCompletionMessages(buildSystemPrompt(), next),
        MENTOR_MAX_TOKENS,
        controller.signal,
        (delta) => {
          if (controller.signal.aborted) return
          if (!started) {
            started = true
            setThinking(false)
            setStreaming(true)
            setHistory((h) => [...h, { role: 'mentor', text: delta }])
          } else {
            setHistory((h) => appendToLastMentor(h, delta))
          }
        },
      )
      if (!controller.signal.aborted && !started) {
        setHistory((h) => [...h, { role: 'mentor', text: full || '…' }])
      }
      if (!controller.signal.aborted) track({ name: 'mentor_response_received' })
    } catch (err) {
      if (!controller.signal.aborted) {
        setHistory((h) => [...h, { role: 'mentor', text: mentorFailureMessage(err, t) }])
        track({ name: 'mentor_request_failed', props: { reason: mentorFailureReason(err) } })
      }
    } finally {
      if (!controller.signal.aborted) setStreaming(false)
      setThinking(false)
    }
  }

  const inputDisabled = !aiReady || loadingInitial
  const placeholder = !aiReady
    ? t.mentor.placeholderNeedsSetup
    : selectedNodeText
      ? t.mentor.placeholder(selectedNodeText)
      : t.mentor.placeholderGraph

  return (
    <div
      style={{
        position: 'absolute',
        left: leftInset,
        right: rightInset,
        bottom: STATUS_BAR_HEIGHT_PX,
        zIndex: 27,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        transition: 'left 180ms ease, right 180ms ease',
      }}
    >
      <div
        style={{
          width: 620,
          maxWidth: 'calc(100% - 48px)',
          margin: '0 24px 16px',
          maxHeight: '58vh',
          background: 'linear-gradient(180deg, var(--bg-card), var(--bg-elev))',
          border: '0.5px solid var(--line-strong)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: mentorPanelExpanded
            ? 'translateY(0) scale(1)'
            : 'translateY(24px) scale(0.985)',
          opacity: mentorPanelExpanded ? 1 : 0,
          pointerEvents: mentorPanelExpanded ? 'auto' : 'none',
          transition: 'transform 0.34s cubic-bezier(.34,.2,.2,1.02), opacity 0.24s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-5)',
            padding: '12px 14px 10px',
            borderBottom: '0.5px solid var(--line)',
            flexShrink: 0,
          }}
        >
          <SocratesGlyph size={32} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
            <b
              style={{
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.005em',
              }}
            >
              {t.mentor.name}
            </b>
            <small
              style={{
                fontSize: '10px',
                fontWeight: 400,
                fontFamily: 'var(--font-mono)',
                color: 'var(--ink-4)',
                letterSpacing: '0.02em',
              }}
            >
              {settings.aiModel}
            </small>
          </div>
          <button
            type="button"
            title={settings.language === 'it' ? 'Nuova chat' : 'New chat'}
            disabled={loadingInitial || thinking}
            onClick={() => setChatKey((k) => k + 1)}
            style={{
              appearance: 'none',
              border: 0,
              background: 'transparent',
              color: 'var(--ink-4)',
              cursor: 'pointer',
              width: 24,
              height: 24,
              borderRadius: 'var(--radius-pill)',
              opacity: loadingInitial || thinking ? 0.3 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              if (!loadingInitial && !thinking) {
                e.currentTarget.style.color = 'var(--ink-2)'
                e.currentTarget.style.background = 'var(--paper-deep)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--ink-4)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
          <CloseButton onClick={() => setMentorPanelExpanded(false)} />
        </div>

        <div
          ref={scrollRef}
          className="nesso-scrollbar"
          style={{
            padding: '12px 16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 1,
            minHeight: 0,
          }}
        >
          {loadingInitial && history.length === 0 ? (
            <ThinkingIndicator />
          ) : (
            history.map((m, i) =>
              m.role === 'user' ? (
                <div
                  key={i}
                  style={{ display: 'flex', justifyContent: 'flex-end', margin: '5px 0' }}
                >
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      lineHeight: 1.45,
                      fontFamily: 'var(--font-sans)',
                      color: 'var(--ink-2)',
                      padding: '7px 11px',
                      background: 'var(--paper-deep)',
                      borderRadius:
                        'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)',
                      marginLeft: 36,
                      border: '0.5px solid var(--line)',
                      display: 'inline-block',
                      maxWidth: '100%',
                    }}
                  >
                    {m.text}
                  </span>
                </div>
              ) : (
                <div
                  key={i}
                  style={{
                    fontSize: '14.5px',
                    fontWeight: 400,
                    lineHeight: 1.45,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--ink)',
                    letterSpacing: '-0.005em',
                    margin: '5px 0',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {renderWithEmphasis(m.text)}
                  {streaming && i === history.length - 1 && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 1.5,
                        height: '0.95em',
                        background: 'var(--ink-3)',
                        marginLeft: 2,
                        verticalAlign: 'text-bottom',
                        animation: 'nx-tw-caret 0.85s steps(2, end) infinite',
                      }}
                    />
                  )}
                </div>
              ),
            )
          )}
          {thinking && <ThinkingIndicator />}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 'var(--space-3)',
            padding: '10px 10px 10px 16px',
            borderTop: '0.5px solid var(--line)',
            flexShrink: 0,
          }}
        >
          <textarea
            ref={inputRef}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            disabled={inputDisabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(draft)
              }
            }}
            rows={1}
            style={{
              flex: 1,
              appearance: 'none',
              border: 0,
              outline: 0,
              resize: 'none',
              background: 'transparent',
              color: 'var(--ink)',
              fontSize: '14px',
              fontWeight: 400,
              lineHeight: 1.45,
              fontFamily: 'var(--font-sans)',
              padding: '6px 0',
              maxHeight: 120,
              minHeight: 22,
              opacity: inputDisabled ? 0.4 : 1,
            }}
          />
          <button
            type="button"
            onClick={() => void send(draft)}
            disabled={!draft.trim() || thinking || loadingInitial}
            style={{
              appearance: 'none',
              border: 0,
              background: 'var(--ink-2)',
              color: 'var(--paper)',
              width: 30,
              height: 30,
              borderRadius: 'var(--radius-circle)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              opacity: !draft.trim() || thinking || loadingInitial ? 0.3 : 1,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 7h9M7.5 3l4 4-4 4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
