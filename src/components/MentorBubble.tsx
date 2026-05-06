// SPDX-License-Identifier: AGPL-3.0
import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react'
import type { Node } from '@xyflow/react'
import { SocratesGlyph } from './SocratesGlyph'
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from '@/store/graph'
import { daysAgo, type ConceptNodeData } from '@/types/graph'
import { marked } from 'marked'
import { getEngine, LOCAL_MODEL_ID, LOCAL_MODEL_LABEL } from '@/llm/webllm'

type MentorMode = 'gap' | 'explore' | 'bootstrap'

interface Message {
  role: 'user' | 'mentor'
  text: string
}

function renderMarkdown(text: string): string {
  return marked(text, { async: false }) as string
}

function priorityNodes(nodes: Node<ConceptNodeData>[]) {
  return nodes
    .filter(n => n.data.conf < 4 || daysAgo(n.data.reviewedAt) > 14)
    .sort((a, b) => a.data.conf - b.data.conf || daysAgo(b.data.reviewedAt) - daysAgo(a.data.reviewedAt))
}

const MENTOR_BASE = [
  'You are Socrates, a Socratic mentor inside a knowledge graph for active learning called Nesso.',
  'Strict rules:',
  '— Never generate graph content for the user. Do not propose new nodes or edges.',
  '— Speak warmly but precisely. No emojis, no flattery.',
  '— Markdown emphasis: surround a key word with *asterisks* to highlight it.',
  '— Do NOT output any structured tokens or brackets.',
]

function buildReviewPrompt(node: Node<ConceptNodeData>): string {
  return [
    ...MENTOR_BASE,
    '',
    'Mode: Review',
    `Currently reviewing: "${node.data.text}" (confidence: ${node.data.conf}/5, last reviewed: ${daysAgo(node.data.reviewedAt)} days ago).`,
    'Focus entirely on this concept. Ask one pointed Socratic question to probe the learner\'s understanding.',
    'Do not mention other nodes. Keep your response under 90 words.',
  ].join('\n')
}

const TABS: { key: MentorMode; label: string }[] = [
  { key: 'gap', label: 'Review' },
  { key: 'explore', label: 'Exploration' },
  { key: 'bootstrap', label: 'Bootstrap' },
]

export function MentorBubble() {
  const mentorPanelExpanded = useGraphStore(s => s.mentorPanelExpanded)
  const setMentorPanelExpanded = useGraphStore(s => s.setMentorPanelExpanded)
  const { nodes, edges } = useGraphStore()
  const currentGraphId = useGraphStore(s => s.currentGraphId)
  const settings = useGraphStore(s => s.settings)
  const updateNodeData = useGraphStore(s => s.updateNodeData)
  const selectedNode = useGraphStore(selectedNodeSelector)
  const selectedEdge = useGraphStore(selectedEdgeSelector)

  const [mode, setMode] = useState<MentorMode>('gap')
  const [bootstrapText, setBootstrapText] = useState<string | null>(null)
  const [bootstrapFileName, setBootstrapFileName] = useState<string | null>(null)
  const [history, setHistory] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [sessionKey, setSessionKey] = useState(0)
  const [reviewQueue, setReviewQueue] = useState<string[]>([])
  const [reviewQueueIdx, setReviewQueueIdx] = useState(0)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentReviewNode = mode === 'gap' && reviewQueueIdx < reviewQueue.length
    ? (nodes.find(n => n.id === reviewQueue[reviewQueueIdx]) ?? null)
    : null

  const fetchCompletion = useCallback(async (systemPrompt: string, msgs: Message[]): Promise<string> => {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...msgs.map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.text })),
    ]

    if (settings.aiMode === 'local') {
      const engine = getEngine()
      if (!engine) throw new Error('Local model not loaded — open Settings and click "Download & use".')
      const reply = await engine.chat.completions.create({ model: LOCAL_MODEL_ID, max_tokens: 300, messages })
      return reply.choices[0]?.message?.content ?? '…'
    }

    const baseUrl = settings.aiBaseUrl.replace(/\/+$/, '')
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.aiApiKey ? { Authorization: `Bearer ${settings.aiApiKey}` } : {}),
      },
      body: JSON.stringify({ model: settings.aiModel, max_tokens: 300, messages }),
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json() as { choices?: { message?: { content?: string | null } }[] }
    return data.choices?.[0]?.message?.content ?? '…'
  }, [settings])

  const buildSystemPrompt = useCallback((): string => {
    if (mode === 'gap') {
      const node = reviewQueueIdx < reviewQueue.length
        ? (nodes.find(n => n.id === reviewQueue[reviewQueueIdx]) ?? null)
        : null
      if (!node) return [...MENTOR_BASE, '', 'Mode: Review', 'All concepts are well covered. Congratulate the learner briefly.'].join('\n')
      return buildReviewPrompt(node)
    }

    if (mode === 'explore') {
      const nodeList = nodes.map(n => `"${n.data.text}" (conf: ${n.data.conf}/5)`).join(', ') || '(no nodes)'
      const edgeList = edges.slice(0, 20).map(e => {
        const src = nodes.find(n => n.id === e.source)?.data.text ?? e.source
        const tgt = nodes.find(n => n.id === e.target)?.data.text ?? e.target
        return `${src} → ${String(e.data?.type ?? '?')} → ${tgt}`
      }).join('; ')
      const selCtx = selectedNode
        ? `Currently selected: "${selectedNode.data.text}" (conf: ${selectedNode.data.conf}/5).`
        : selectedEdge
        ? `Currently selected edge: ${String(edges.find(e => e.id === selectedEdge.id)?.data?.type ?? '?')}.`
        : ''
      return [
        ...MENTOR_BASE,
        '',
        'Mode: Free Exploration',
        'The learner wants to explore their knowledge graph freely. Answer questions, highlight connections, suggest areas to investigate.',
        '— Prefer one short question over a paragraph of explanation.',
        '— Keep responses under 90 words.',
        '',
        `Nodes: ${nodeList}`,
        edgeList ? `Edges: ${edgeList}` : '',
        selCtx,
      ].filter(Boolean).join('\n')
    }

    return [
      ...MENTOR_BASE,
      '',
      'Mode: Bootstrap',
      'The learner is building a knowledge graph from a source document.',
      'Help them identify key concepts and understand their relationships.',
      'Do NOT create nodes or edges for them — discuss concepts and ask which ones they want to map.',
      '— Prefer one short question over a paragraph of explanation.',
      '— Keep responses under 90 words.',
      '',
      bootstrapText ? `Document excerpt:\n${bootstrapText.slice(0, 3000)}` : '(no document loaded)',
    ].join('\n')
  }, [mode, reviewQueue, reviewQueueIdx, nodes, edges, selectedNode, selectedEdge, bootstrapText])

  const callApi = useCallback((msgs: Message[]) =>
    fetchCompletion(buildSystemPrompt(), msgs),
    [fetchCompletion, buildSystemPrompt]
  )

  useEffect(() => {
    if (!mentorPanelExpanded) return
    if (mode === 'bootstrap' && !bootstrapText) {
      setHistory([])
      setSessionComplete(false)
      return
    }

    let queue: string[] = []
    if (mode === 'gap') {
      queue = priorityNodes(nodes).map(n => n.id)
      setReviewQueue(queue)
      setReviewQueueIdx(0)

      if (queue.length === 0) {
        setHistory([{ role: 'mentor', text: 'Your graph looks solid — all concepts have good confidence and recent reviews. Well done.' }])
        setSessionComplete(true)
        return
      }
    }

    let cancelled = false
    setHistory([])
    setSessionComplete(false)
    setLoadingInitial(true)

    const firstNode = mode === 'gap' && queue.length > 0 ? nodes.find(n => n.id === queue[0]) ?? null : null
    const systemPrompt = firstNode ? buildReviewPrompt(firstNode) : buildSystemPrompt()
    const seedText =
      mode === 'gap' ? 'Start the review session. Begin with the weakest concept.' :
      mode === 'explore' ? 'Hello, I want to explore my knowledge graph.' :
      'I loaded a document. Help me build my knowledge graph from it.'

    fetchCompletion(systemPrompt, [{ role: 'user', text: seedText }])
      .then(raw => { if (!cancelled) setHistory([{ role: 'mentor', text: raw }]) })
      .catch(() => { if (!cancelled) setHistory([{ role: 'mentor', text: '*Hmm.* My voice failed me. Try again.' }]) })
      .finally(() => { if (!cancelled) setLoadingInitial(false) })

    return () => { cancelled = true }
  }, [mentorPanelExpanded, mode, currentGraphId, bootstrapText, sessionKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mentorPanelExpanded && inputRef.current) inputRef.current.focus()
  }, [mentorPanelExpanded])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [history, thinking, loadingInitial])

  const send = async (text: string) => {
    if (!text.trim() || thinking || loadingInitial || sessionComplete) return
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

  const rateNode = async (conf: number | null) => {
    if (thinking || loadingInitial) return
    const nodeId = reviewQueue[reviewQueueIdx]
    const nextIdx = reviewQueueIdx + 1
    const nextNode = nextIdx < reviewQueue.length ? (nodes.find(n => n.id === reviewQueue[nextIdx]) ?? null) : null
    const nextSysPrompt = nextNode ? buildReviewPrompt(nextNode) : ''
    const transMsg: Message = { role: 'user', text: "Good, let's continue." }
    const nextHistory = [...history, transMsg]

    if (conf !== null && nodeId) updateNodeData(nodeId, { conf, reviewedAt: Date.now() })
    setReviewQueueIdx(nextIdx)

    if (!nextNode) {
      setSessionComplete(true)
      return
    }

    setHistory(nextHistory)
    setThinking(true)
    try {
      const raw = await fetchCompletion(nextSysPrompt, nextHistory)
      setHistory(h => [...h, { role: 'mentor', text: raw }])
    } catch {
      setHistory(h => [...h, { role: 'mentor', text: '*Hmm.* My voice failed me.' }])
    } finally {
      setThinking(false)
    }
  }

  const handleFileLoad = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setBootstrapText(ev.target?.result as string)
      setBootstrapFileName(file.name)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const unread = !mentorPanelExpanded && history.length > 0 && history[history.length - 1].role === 'mentor'
    ? history.filter(m => m.role === 'mentor').length
    : 0

  const inputDisabled = sessionComplete || loadingInitial || (mode === 'bootstrap' && !bootstrapText)
  const placeholder =
    sessionComplete ? 'Session complete.' :
    mode === 'bootstrap' && !bootstrapText ? 'Load a document first…' :
    selectedNode ? `Ask Socrates about "${selectedNode.data.text}"…` : 'Ask Socrates…'

  return (
    <div style={{
      position: 'absolute', right: 22, bottom: 22, zIndex: 35,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10,
    }}>
      {/* Card */}
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
        {/* Header */}
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
            <small style={{
              font: "500 10.5px 'JetBrains Mono', ui-monospace",
              color: sessionComplete ? 'var(--conf-5)' : 'var(--cat-causal)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <PulseDot active={!sessionComplete} />
              {sessionComplete ? 'Session complete' : 'Mentor · live'}
            </small>
            <small style={{
              font: "400 10px 'JetBrains Mono', ui-monospace",
              color: 'var(--ink-4)', letterSpacing: '0.02em',
            }}>
              {settings.aiMode === 'local' ? LOCAL_MODEL_LABEL : settings.aiModel}
            </small>
          </div>
          <button
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

        {/* Mode tabs */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid var(--line)', padding: '0 14px', gap: 2 }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => { setMode(tab.key); setSessionComplete(false) }} style={{
              appearance: 'none', border: 0, background: 'transparent',
              font: "500 11px 'JetBrains Mono', ui-monospace",
              letterSpacing: '0.04em', textTransform: 'uppercase',
              color: mode === tab.key ? 'var(--ink)' : 'var(--ink-4)',
              padding: '8px 10px 7px', cursor: 'default',
              borderBottom: mode === tab.key ? '2px solid var(--cat-causal)' : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s',
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Review: current node indicator */}
        {mode === 'gap' && currentReviewNode && !sessionComplete && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 16px 6px 13px', borderBottom: '0.5px solid var(--line)',
            background: 'var(--bg-elev)',
            borderLeft: '3px solid var(--cat-causal)',
          }}>
            <span style={{
              font: "500 10px 'JetBrains Mono', ui-monospace",
              color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
            }}>
              {reviewQueueIdx + 1}/{reviewQueue.length}
            </span>
            <span style={{
              font: "400 13px 'Fraunces', ui-serif", color: 'var(--ink)',
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {currentReviewNode.data.text}
            </span>
          </div>
        )}

        {/* Bootstrap document area */}
        {mode === 'bootstrap' && (
          <div style={{
            padding: '10px 16px', borderBottom: '0.5px solid var(--line)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <input ref={fileInputRef} type="file" accept=".txt,.md" style={{ display: 'none' }} onChange={handleFileLoad} />
            {bootstrapText ? (
              <>
                <span style={{
                  font: "400 12px 'JetBrains Mono', ui-monospace", color: 'var(--ink-2)',
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{bootstrapFileName}</span>
                <button
                  onClick={() => { setBootstrapText(null); setBootstrapFileName(null) }}
                  style={{
                    appearance: 'none', border: '0.5px solid var(--line)', background: 'var(--paper-deep)',
                    color: 'var(--ink-3)', font: "400 11px 'Inter', system-ui",
                    borderRadius: 6, padding: '3px 8px', cursor: 'default',
                  }}
                >Remove</button>
              </>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  appearance: 'none', border: '0.5px dashed var(--line)', background: 'transparent',
                  color: 'var(--ink-3)', font: "400 12px 'Inter', system-ui",
                  borderRadius: 8, padding: '8px 12px', cursor: 'default', flex: 1, textAlign: 'center',
                }}
              >Load .txt or .md — PDF coming soon</button>
            )}
          </div>
        )}

        {/* Conversation */}
        <div ref={scrollRef} style={{
          padding: '14px 16px 6px', overflowY: 'auto', flex: 1, minHeight: 80, scrollbarWidth: 'thin',
        }}>
          {loadingInitial && history.length === 0 ? (
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
            )
          )}
          {thinking && <ThinkingDots />}
          {sessionComplete && (
            <p style={{
              font: "400 12px/1.4 'JetBrains Mono', ui-monospace",
              color: 'var(--conf-5)', letterSpacing: '0.02em', margin: '4px 0 0', textAlign: 'center',
            }}>All concepts covered. Well done.</p>
          )}
        </div>

        {/* Review: confidence rating strip */}
        {mode === 'gap' && currentReviewNode && !sessionComplete && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '8px 14px', borderTop: '0.5px solid var(--line)',
          }}>
            <span style={{
              font: "400 10px 'JetBrains Mono', ui-monospace",
              color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, marginRight: 2,
            }}>Conf</span>
            {([1, 2, 3, 4, 5] as const).map(n => (
              <button key={n} onClick={() => void rateNode(n)} disabled={thinking || loadingInitial} style={{
                appearance: 'none',
                border: `0.5px solid var(--conf-${n})`,
                background: currentReviewNode.data.conf === n ? `var(--conf-${n})` : 'transparent',
                color: currentReviewNode.data.conf === n ? 'var(--paper)' : `var(--conf-${n})`,
                font: "600 11px 'JetBrains Mono', ui-monospace",
                width: 26, height: 26, borderRadius: 6, cursor: 'default', flexShrink: 0,
                opacity: thinking || loadingInitial ? 0.4 : 1,
                transition: 'background 0.1s, color 0.1s',
              }}>{n}</button>
            ))}
            <button onClick={() => void rateNode(null)} disabled={thinking || loadingInitial} style={{
              appearance: 'none', border: 0, background: 'transparent',
              color: 'var(--ink-4)', font: "400 11px 'JetBrains Mono', ui-monospace",
              padding: '4px 4px', cursor: 'default', marginLeft: 'auto',
              opacity: thinking || loadingInitial ? 0.4 : 1,
            }}>Skip →</button>
          </div>
        )}

        {/* Input */}
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
          {sessionComplete ? (
            <button onClick={() => setSessionKey(k => k + 1)} style={{
              appearance: 'none', border: '0.5px solid var(--line)', background: 'var(--paper-deep)',
              color: 'var(--ink-2)', font: "400 11px 'JetBrains Mono', ui-monospace",
              borderRadius: 8, padding: '5px 10px', cursor: 'default', flexShrink: 0,
            }}>Restart</button>
          ) : (
            <button onClick={() => void send(draft)} disabled={!draft.trim() || thinking || loadingInitial} style={{
              appearance: 'none', border: 0, background: 'var(--ink)', color: 'var(--paper)',
              width: 30, height: 30, borderRadius: '50%',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'default', flexShrink: 0,
              opacity: !draft.trim() || thinking || loadingInitial ? 0.3 : 1,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 7h9M7.5 3l4 4-4 4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* FAB */}
      <button onClick={() => setMentorPanelExpanded(!mentorPanelExpanded)} title="Socrates" style={{
        width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-elev)',
        color: 'var(--ink)', border: '0.5px solid var(--line)', boxShadow: 'var(--shadow-lg)',
        cursor: 'default', padding: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      }}>
        <SpinRing />
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
        @keyframes nx-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
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

function PulseDot({ active }: { active: boolean }) {
  return (
    <span style={{
      width: 5, height: 5, borderRadius: '50%',
      background: active ? 'var(--cat-causal)' : 'var(--conf-5)',
      animation: active ? 'nx-pulse 2.6s ease-in-out infinite' : 'none',
      display: 'inline-block',
    }} />
  )
}

function SpinRing() {
  return (
    <span style={{
      position: 'absolute', inset: -3, borderRadius: '50%',
      border: '1px dashed var(--cat-causal)', opacity: 0.45,
      animation: 'nx-spin 28s linear infinite', pointerEvents: 'none',
    }} />
  )
}
