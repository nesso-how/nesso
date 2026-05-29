// SPDX-License-Identifier: MIT
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { SocratesGlyph } from './SocratesGlyph'
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from '@/store/graph'
import type { ConceptNodeData, Language } from '@/types/graph'
import { getEngine, useWebLLM, LOCAL_MODEL_ID, LOCAL_MODEL_LABEL } from '@/llm/webllm'
import { buildFocalNeighborContext, nodeStrength, oneHopNeighborIds } from '@/llm/context'
import { useT } from '@/i18n'
import { CloseButton } from './CloseButton'
import { ThinkingIndicator } from './ThinkingIndicator'
import { Typewriter } from './Typewriter'

interface Message {
  role: 'user' | 'mentor'
  text: string
}

/** Cap snapshot size so the system prompt stays bounded on large graphs. */
const MAX_SNAPSHOT_NODES = 60
/** Linked maps often have more edges than nodes; ~2× node cap keeps structure visible without dumping huge |E|. */
const MAX_SNAPSHOT_EDGES = MAX_SNAPSHOT_NODES * 2
/** Output ceiling aligned with ~200-word replies (soft limit in getMentorBase). */
const MENTOR_MAX_TOKENS = 380

const NODE_LEGEND = 'Reading each node after its quoted title: (new)=no spaced-repetition review yet; otherwise comma-separated tokens — s=Y.Yd is FSRS stability in days (higher = stronger recall); Nd since review is calendar days since the last FSRS self-rating; Again/Hard/Good/Easy is that rating; DUE means the scheduler says revisit now (light hint, secondary to s= and rating).'

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
    'When neither a node nor an edge is selected on open: pick the graph\'s weakest spot by stability and last review; consider DUE as extra context, then open with one question there.',
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
  const label = (id: string) => nodes.find(n => n.id === id)?.data.text ?? id
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
  const label = (id: string) => nodes.find(n => n.id === id)?.data.text ?? id
  const snapEdges = edges.length > MAX_SNAPSHOT_EDGES ? edges.slice(0, MAX_SNAPSHOT_EDGES) : edges
  const edgeOmit = edges.length > snapEdges.length ? ` … (${edges.length - snapEdges.length} more edges omitted)` : ''
  const edgeListBody = snapEdges.map(e => {
    const src = label(e.source)
    const tgt = label(e.target)
    return `${src} → ${String(e.data?.type ?? '?')} → ${tgt}`
  }).join('; ')
  const edgeList = edgeListBody ? `${edgeListBody}${edgeOmit}` : ''
  const sortedNodes = [...nodes].sort((a, b) => nodeStrength(a) - nodeStrength(b))
  const snapNodes = sortedNodes.length > MAX_SNAPSHOT_NODES ? sortedNodes.slice(0, MAX_SNAPSHOT_NODES) : sortedNodes
  const nodeOmit = sortedNodes.length > snapNodes.length ? ` … (${sortedNodes.length - snapNodes.length} more nodes omitted)` : ''
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
    const neighbors = nodes.filter(n => neighborIds.has(n.id))
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
  ].filter(Boolean).join('\n')
}

export function MentorBubble() {
  const t = useT()
  const mentorPanelExpanded = useGraphStore(s => s.mentorPanelExpanded)
  const setMentorPanelExpanded = useGraphStore(s => s.setMentorPanelExpanded)
  const { nodes, edges } = useGraphStore()
  const currentGraphId = useGraphStore(s => s.currentGraphId)
  const settings = useGraphStore(s => s.settings)
  const selectedNode = useGraphStore(selectedNodeSelector)
  const selectedEdge = useGraphStore(selectedEdgeSelector)

  const webllm = useWebLLM()
  const modelLoading = settings.aiMode === 'local' && webllm.status === 'loading'
  const modelReady = settings.aiMode !== 'local' || webllm.status === 'ready'
  const localModelAwaitingSetup = settings.aiMode === 'local' && webllm.status !== 'ready' && webllm.status !== 'loading'

  const [history, setHistory] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(false)
  const [chatKey, setChatKey] = useState(0)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const buildSystemPrompt = useCallback(
    () => buildGraphChatPrompt(nodes, edges, selectedNode, selectedEdge, settings.language),
    [nodes, edges, selectedNode, selectedEdge, settings.language],
  )

  const fetchCompletion = useCallback(async (systemPrompt: string, msgs: Message[]): Promise<string> => {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...msgs.map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.text })),
    ]

    if (settings.aiMode === 'local') {
      const engine = getEngine()
      if (!engine) throw new Error('Local model not loaded. Open Settings and click "Download & use".')
      const reply = await engine.chat.completions.create({ model: LOCAL_MODEL_ID, max_tokens: MENTOR_MAX_TOKENS, messages })
      return reply.choices[0]?.message?.content ?? '…'
    }

    const baseUrl = settings.aiBaseUrl.replace(/\/+$/, '')
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.aiApiKey ? { Authorization: `Bearer ${settings.aiApiKey}` } : {}),
      },
      body: JSON.stringify({ model: settings.aiModel, max_tokens: MENTOR_MAX_TOKENS, messages }),
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json() as { choices?: { message?: { content?: string | null } }[] }
    return data.choices?.[0]?.message?.content ?? '…'
  }, [settings])

  useEffect(() => {
    if (!mentorPanelExpanded) return
    if (settings.aiMode === 'local' && webllm.status === 'loading') {
      setHistory([])
      setLoadingInitial(false)
      return
    }
    if (settings.aiMode === 'local' && webllm.status !== 'ready') {
      const text = webllm.status === 'error' ? t.mentor.localModelLoadFailed : t.mentor.localModelNeedDownload
      setHistory([{ role: 'mentor', text }])
      setLoadingInitial(false)
      return
    }

    let cancelled = false
    setHistory([])
    setLoadingInitial(true)

    const systemPrompt = buildSystemPrompt()
    const seedText = buildMentorSeedText(settings.language, nodes, selectedNode, selectedEdge)

    fetchCompletion(systemPrompt, [{ role: 'user', text: seedText }])
      .then(raw => { if (!cancelled) setHistory([{ role: 'mentor', text: raw }]) })
      .catch(() => { if (!cancelled) setHistory([{ role: 'mentor', text: t.mentor.errorRetry }]) })
      .finally(() => { if (!cancelled) setLoadingInitial(false) })

    return () => { cancelled = true }
  }, [mentorPanelExpanded, currentGraphId, webllm.status, settings.aiMode, settings.language, chatKey]) // eslint-disable-line react-hooks/exhaustive-deps -- opening line tied to graph open/switch; live sends use fresh prompt via buildSystemPrompt

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
    const next: Message[] = [...history, { role: 'user', text }]
    setHistory(next)
    setDraft('')
    setThinking(true)
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
    try {
      const raw = await fetchCompletion(buildSystemPrompt(), next)
      setHistory(h => [...h, { role: 'mentor', text: raw }])
    } catch {
      setHistory(h => [...h, { role: 'mentor', text: t.mentor.errorRetrySlow }])
    } finally {
      setThinking(false)
    }
  }

  const unread = !mentorPanelExpanded && history.length > 0 && history[history.length - 1].role === 'mentor'
    ? history.filter(m => m.role === 'mentor').length
    : 0

  const inputDisabled = !modelReady || loadingInitial
  const placeholder =
    modelLoading ? t.mentor.loadingModel :
    localModelAwaitingSetup ? t.mentor.placeholderLocalPending :
    selectedNode ? t.mentor.placeholder(selectedNode.data.text) : t.mentor.placeholderGraph

  return (
    <div style={{
      position: 'absolute', right: 22, bottom: 22, zIndex: 35,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10,
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 380, maxWidth: '86vw', maxHeight: '72vh',
        background: 'linear-gradient(180deg, var(--bg-card), var(--bg-elev))',
        border: '0.5px solid var(--line)', borderRadius: 18, boxShadow: 'var(--shadow-lg)',
        display: 'flex', flexDirection: 'column',
        transform: mentorPanelExpanded ? 'none' : 'translateY(8px) scale(0.96)',
        opacity: mentorPanelExpanded ? 1 : 0,
        pointerEvents: mentorPanelExpanded ? 'auto' : 'none',
        transition: 'all 0.32s cubic-bezier(.4,.2,.2,1.05)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px 10px', borderBottom: '0.5px solid var(--line)',
          flexShrink: 0,
        }}>
          <span style={{
            width: 30, height: 30, borderRadius: '50%', background: 'var(--paper-deep)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <SocratesGlyph size={26} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
            <b style={{ font: "500 13px 'Fraunces', serif", letterSpacing: '-0.005em' }}>{t.mentor.name}</b>
            {modelLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{
                  height: 2, borderRadius: 999, background: 'var(--line)', overflow: 'hidden', width: '100%',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 999, background: 'var(--accent)',
                    width: `${Math.round(webllm.progress * 100)}%`,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <small style={{
                  font: "400 10px 'JetBrains Mono', ui-monospace",
                  color: 'var(--ink-4)', letterSpacing: '0.02em',
                }}>
                  {LOCAL_MODEL_LABEL} · {Math.round(webllm.progress * 100)}%
                </small>
              </div>
            ) : (
              <small style={{
                font: "400 10px 'JetBrains Mono', ui-monospace",
                color: 'var(--ink-4)', letterSpacing: '0.02em',
              }}>
                {settings.aiMode === 'local' ? LOCAL_MODEL_LABEL : settings.aiModel}
              </small>
            )}
          </div>
          <button
            type="button"
            title={settings.language === 'it' ? 'Nuova chat' : 'New chat'}
            disabled={loadingInitial || thinking}
            onClick={() => setChatKey(k => k + 1)}
            style={{
              appearance: 'none', border: 0, background: 'transparent',
              color: 'var(--ink-4)', cursor: 'default',
              width: 24, height: 24, borderRadius: 999,
              opacity: loadingInitial || thinking ? 0.3 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { if (!loadingInitial && !thinking) { e.currentTarget.style.color = 'var(--ink-2)'; e.currentTarget.style.background = 'var(--paper-deep)' } }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-4)'; e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
          <CloseButton onClick={() => setMentorPanelExpanded(false)} />
        </div>

        <div ref={scrollRef} className="nesso-scrollbar" style={{
          padding: '12px 16px', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
          flexShrink: 1, minHeight: 0,
        }}>
          {modelLoading ? (
            <div style={{
              font: "400 14.5px/1.5 'Fraunces', ui-serif, Georgia, serif",
              color: 'var(--ink)',
              letterSpacing: '-0.005em',
              margin: '5px 0',
            }}>
              {t.mentor.loadingLocalModelNotice}
            </div>
          ) : loadingInitial && history.length === 0 ? (
            <ThinkingIndicator />
          ) : history.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', margin: '5px 0' }}>
                <span style={{
                  font: "500 13px/1.45 'Inter', system-ui", color: 'var(--ink-2)',
                  padding: '7px 11px', background: 'var(--paper-deep)',
                  borderRadius: '14px 14px 4px 14px', marginLeft: 36,
                  border: '0.5px solid var(--line)', display: 'inline-block', maxWidth: '100%',
                }}>{m.text}</span>
              </div>
            ) : (
              <div key={i} style={{
                font: "400 14.5px/1.45 'Fraunces', ui-serif, Georgia, serif",
                color: 'var(--ink)', letterSpacing: '-0.005em', margin: '5px 0',
                whiteSpace: 'pre-wrap',
              }}>
                <Typewriter text={m.text} emphasis />
              </div>
            ),
          )}
          {thinking && <ThinkingIndicator />}
        </div>

        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 6,
          padding: '10px 10px 10px 16px', borderTop: '0.5px solid var(--line)',
          flexShrink: 0,
        }}>
          <textarea
            ref={inputRef}
            value={draft}
            placeholder={placeholder}
            onChange={e => setDraft(e.target.value)}
            disabled={inputDisabled}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(draft) } }}
            rows={1}
            style={{
              flex: 1, appearance: 'none', border: 0, outline: 0, resize: 'none',
              background: 'transparent', color: 'var(--ink)',
              font: "400 14px/1.45 'Inter', system-ui",
              padding: '6px 0', maxHeight: 120, minHeight: 22,
              opacity: inputDisabled ? 0.4 : 1,
            }}
          />
          <button
            type="button"
            onClick={() => void send(draft)}
            disabled={!draft.trim() || thinking || loadingInitial}
            style={{
              appearance: 'none', border: 0, background: 'var(--ink)', color: 'var(--paper)',
              width: 30, height: 30, borderRadius: '50%',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'default', flexShrink: 0,
              opacity: !draft.trim() || thinking || loadingInitial ? 0.3 : 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 7h9M7.5 3l4 4-4 4" />
            </svg>
          </button>
        </div>
      </div>

      <button type="button" onClick={() => setMentorPanelExpanded(!mentorPanelExpanded)} title={t.mentor.toggleTitle} style={{
        width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-elev)',
        color: 'var(--ink)', border: '0.5px solid var(--line)', boxShadow: 'var(--shadow-lg)',
        cursor: 'default', padding: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
        pointerEvents: 'auto',
      }}>
        <SpinRing loading={modelLoading} />
        <SocratesGlyph size={42} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16,
            borderRadius: 999, background: 'var(--accent)', color: 'var(--paper)',
            font: "600 10px 'JetBrains Mono', ui-monospace",
            padding: '0 4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-elev)',
          }}>{unread}</span>
        )}
      </button>

      <style>{`
        @keyframes nx-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function SpinRing({ loading }: { loading: boolean }) {
  return (
    <span style={{
      position: 'absolute', inset: -3, borderRadius: '50%',
      border: loading
        ? '1.5px solid transparent'
        : '1px dashed var(--accent)',
      borderTopColor: loading ? 'var(--accent)' : undefined,
      borderRightColor: loading ? 'var(--accent)' : undefined,
      borderBottomColor: loading ? 'var(--accent)' : undefined,
      opacity: loading ? 1 : 0.45,
      animation: `nx-spin ${loading ? '1s' : '28s'} linear infinite`,
      pointerEvents: 'none',
    }} />
  )
}
