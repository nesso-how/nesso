// SPDX-License-Identifier: MIT
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { SocratesGlyph } from './SocratesGlyph'
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from '@/store/graph'
import type { ConceptNodeData } from '@/types/graph'
import { marked } from 'marked'
import { getEngine, useWebLLM, LOCAL_MODEL_ID, LOCAL_MODEL_LABEL } from '@/llm/webllm'

interface Message {
  role: 'user' | 'mentor'
  text: string
}

function renderMarkdown(text: string): string {
  return marked(text, { async: false }) as string
}

/** Cap snapshot size so the system prompt stays bounded on large graphs. */
const MAX_SNAPSHOT_NODES = 60
/** Linked maps often have more edges than nodes; ~2× node cap keeps structure visible without dumping huge |E|. */
const MAX_SNAPSHOT_EDGES = MAX_SNAPSHOT_NODES * 2
/** Output ceiling aligned with ~120-word replies (soft limit in MENTOR_BASE). */
const MENTOR_MAX_TOKENS = 220

const MENTOR_BASE = [
  'You are Socrates in Nesso, a knowledge-graph app for active learning. Be warm, precise, and Socratic: mostly questions, almost no lecturing.',
  'Never tell the user what nodes or edges to add or rename—no graph edits, only dialogue about ideas.',
  'No emojis or flattery. Use *asterisks* sparingly for a key term. No JSON, markup pseudo-graphs, or bracketed labels.',
  'Default: one short question; explain only to frame the question. Aim under ~120 words.',
]

function buildGraphChatPrompt(
  nodes: Node<ConceptNodeData>[],
  edges: Edge[],
  selectedNode: Node<ConceptNodeData> | null,
  selectedEdge: Edge | null,
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
  const snapNodes = nodes.length > MAX_SNAPSHOT_NODES ? nodes.slice(0, MAX_SNAPSHOT_NODES) : nodes
  const nodeOmit = nodes.length > snapNodes.length ? ` … (${nodes.length - snapNodes.length} more nodes omitted)` : ''
  const nodeList =
    snapNodes.map(n => `"${n.data.text}" (stability ${n.data.stability.toFixed(1)}d)`).join(', ') + nodeOmit || '(no nodes)'
  const selCtx = selectedNode
    ? `Selection: node "${selectedNode.data.text}" (stability ${selectedNode.data.stability.toFixed(1)}d).`
    : selectedEdge
      ? `Selection: edge ${label(selectedEdge.source)} → ${String(selectedEdge.data?.type ?? '?')} → ${label(selectedEdge.target)}.`
      : ''
  return [
    ...MENTOR_BASE,
    '',
    `Nodes: ${nodeList}`,
    edgeList ? `Edges: ${edgeList}` : '',
    selCtx,
  ].filter(Boolean).join('\n')
}

export function MentorBubble() {
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

  const [history, setHistory] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(false)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const buildSystemPrompt = useCallback(
    () => buildGraphChatPrompt(nodes, edges, selectedNode, selectedEdge),
    [nodes, edges, selectedNode, selectedEdge],
  )

  const fetchCompletion = useCallback(async (systemPrompt: string, msgs: Message[]): Promise<string> => {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...msgs.map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.text })),
    ]

    if (settings.aiMode === 'local') {
      const engine = getEngine()
      if (!engine) throw new Error('Local model not loaded — open Settings and click "Download & use".')
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

  const callApi = useCallback((msgs: Message[]) =>
    fetchCompletion(buildSystemPrompt(), msgs),
  [fetchCompletion, buildSystemPrompt])

  useEffect(() => {
    if (!mentorPanelExpanded) return
    if (settings.aiMode === 'local' && webllm.status !== 'ready') {
      setHistory([])
      setLoadingInitial(false)
      return
    }

    let cancelled = false
    setHistory([])
    setLoadingInitial(true)

    const systemPrompt = buildSystemPrompt()
    const seedText = 'Hello — I want to discuss my knowledge graph.'

    fetchCompletion(systemPrompt, [{ role: 'user', text: seedText }])
      .then(raw => { if (!cancelled) setHistory([{ role: 'mentor', text: raw }]) })
      .catch(() => { if (!cancelled) setHistory([{ role: 'mentor', text: '*Hmm.* My voice failed me. Try again.' }]) })
      .finally(() => { if (!cancelled) setLoadingInitial(false) })

    return () => { cancelled = true }
  }, [mentorPanelExpanded, currentGraphId, webllm.status, settings.aiMode]) // eslint-disable-line react-hooks/exhaustive-deps -- opening line tied to graph open/switch; live sends use fresh prompt via buildSystemPrompt

  useEffect(() => {
    if (mentorPanelExpanded && inputRef.current) inputRef.current.focus()
  }, [mentorPanelExpanded])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [history, thinking, loadingInitial])

  const send = async (text: string) => {
    if (!text.trim() || thinking || loadingInitial) return
    const next: Message[] = [...history, { role: 'user', text }]
    setHistory(next)
    setDraft('')
    setThinking(true)
    try {
      const raw = await callApi(next)
      setHistory(h => [...h, { role: 'mentor', text: raw }])
    } catch {
      setHistory(h => [...h, { role: 'mentor', text: '*Hmm.* My voice failed me. Try again — slowly.' }])
    } finally {
      setThinking(false)
    }
  }

  const unread = !mentorPanelExpanded && history.length > 0 && history[history.length - 1].role === 'mentor'
    ? history.filter(m => m.role === 'mentor').length
    : 0

  const inputDisabled = !modelReady || loadingInitial
  const placeholder =
    modelLoading ? 'Loading local model…' :
    selectedNode ? `Ask Socrates about "${selectedNode.data.text}"…` : 'Ask Socrates about your graph…'

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
        }}>
          <span style={{
            width: 30, height: 30, borderRadius: '50%', background: 'var(--paper-deep)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <SocratesGlyph size={26} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
            <b style={{ font: "500 13px 'Fraunces', serif", letterSpacing: '-0.005em' }}>Socrates</b>
            {modelLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{
                  height: 2, borderRadius: 999, background: 'var(--line)', overflow: 'hidden', width: '100%',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 999, background: 'var(--cat-causal)',
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
            onClick={() => setMentorPanelExpanded(false)}
            style={{
              appearance: 'none', border: 0, background: 'transparent',
              color: 'var(--ink-4)', cursor: 'default', width: 24, height: 24,
              borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)'; e.currentTarget.style.color = 'var(--ink)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-4)' }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12">
              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div ref={scrollRef} style={{
          padding: '14px 16px 6px', overflowY: 'auto', flex: 1, minHeight: 80, scrollbarWidth: 'thin',
        }}>
          {modelLoading ? (
            <p style={{
              font: "400 11px/1.4 'JetBrains Mono', ui-monospace",
              color: 'var(--ink-4)', letterSpacing: '0.02em', margin: 0,
            }}>
              {webllm.progressText || 'Initialising…'}
            </p>
          ) : loadingInitial && history.length === 0 ? (
            <ThinkingDots />
          ) : history.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <span style={{
                  font: "500 13px/1.45 'Inter', system-ui", color: 'var(--ink-2)',
                  padding: '7px 11px', background: 'var(--paper-deep)',
                  borderRadius: '14px 14px 4px 14px', marginLeft: 36,
                  border: '0.5px solid var(--line)', display: 'inline-block', maxWidth: '100%',
                }}>{m.text}</span>
              </div>
            ) : (
              <div key={i} style={{
                font: "400 15px/1.5 'Fraunces', ui-serif, Georgia, serif",
                color: 'var(--ink)', letterSpacing: '-0.005em', margin: '0 0 14px',
              }} dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
            ),
          )}
          {thinking && <ThinkingDots />}
        </div>

        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 6,
          padding: '10px 10px 10px 16px', borderTop: '0.5px solid var(--line)',
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

      <button type="button" onClick={() => setMentorPanelExpanded(!mentorPanelExpanded)} title="Socrates" style={{
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
            borderRadius: 999, background: 'var(--cat-causal)', color: 'var(--paper)',
            font: "600 10px 'JetBrains Mono', ui-monospace",
            padding: '0 4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-elev)',
          }}>{unread}</span>
        )}
      </button>

      <style>{`
        @keyframes nx-think {
          0%, 100% { opacity: 0.25; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
        }
        @keyframes nx-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function ThinkingDots() {
  return (
    <div style={{ display: 'inline-flex', gap: 4, padding: '6px 0' }}>
      {[0, 150, 300].map(delay => (
        <span key={delay} style={{
          width: 5, height: 5, borderRadius: '50%', background: 'var(--ink-4)',
          animation: `nx-think 1.2s ease-in-out ${delay}ms infinite`,
        }} />
      ))}
    </div>
  )
}

function SpinRing({ loading }: { loading: boolean }) {
  return (
    <span style={{
      position: 'absolute', inset: -3, borderRadius: '50%',
      border: loading
        ? '1.5px solid transparent'
        : '1px dashed var(--cat-causal)',
      borderTopColor: loading ? 'var(--cat-causal)' : undefined,
      borderRightColor: loading ? 'var(--cat-causal)' : undefined,
      borderBottomColor: loading ? 'var(--cat-causal)' : undefined,
      opacity: loading ? 1 : 0.45,
      animation: `nx-spin ${loading ? '1s' : '28s'} linear infinite`,
      pointerEvents: 'none',
    }} />
  )
}
