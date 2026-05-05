// SPDX-License-Identifier: AGPL-3.0
import { useState, useRef, useEffect } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import { SocratesGlyph } from './SocratesGlyph'
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from '@/store/graph'
import { EDGE_TYPES, EDGE_CATEGORIES } from '@/data/edgeTypes'
import { SOCRATIC_PROMPTS } from '@/data/seedGraph'
import type { EdgeTypeName } from '@/types/graph'

interface Message {
  role: 'user' | 'mentor'
  text: string
}

function emphasise(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
}

export function MentorBubble() {
  const mentorPanelExpanded = useGraphStore(s => s.mentorPanelExpanded)
  const setMentorPanelExpanded = useGraphStore(s => s.setMentorPanelExpanded)
  const [history, setHistory] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [promptSeed, setPromptSeed] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const selectedNode = useGraphStore(selectedNodeSelector)
  const selectedEdge = useGraphStore(selectedEdgeSelector)
  const { nodes, edges } = useGraphStore()

  // Derive opening prompt from selection
  const openingPrompt = (() => {
    if (selectedEdge) {
      const edgeType = selectedEdge.data?.type as EdgeTypeName
      const T = EDGE_TYPES[edgeType]
      const tailored = SOCRATIC_PROMPTS.find(p => p.trigger === `edge:${edgeType}`)
      if (tailored) return tailored.text
      return `You drew a "${T.label}" relation. Could it be tighter? In ${EDGE_CATEGORIES[T.cat].label.toLowerCase()}, the precise shape matters.`
    }
    if (selectedNode) {
      const tailored = SOCRATIC_PROMPTS.find(p => p.trigger === `node:${selectedNode.data.text}`)
      if (tailored) return tailored.text
      if (selectedNode.data.reviewed > 14 && selectedNode.data.conf >= 4)
        return `You're confident about *${selectedNode.data.text}* (${selectedNode.data.conf}/5), but it's been ${selectedNode.data.reviewed} days. Confidence ages. Want to test it?`
      if (selectedNode.data.conf <= 2)
        return `*${selectedNode.data.text}* is at confidence ${selectedNode.data.conf}/5. What's the one example that would make you raise it to a 4?`
    }
    return SOCRATIC_PROMPTS[promptSeed % SOCRATIC_PROMPTS.length].text
  })()

  useEffect(() => {
    setHistory([{ role: 'mentor', text: openingPrompt }])
  }, [openingPrompt])

  useEffect(() => {
    if (mentorPanelExpanded && inputRef.current) inputRef.current.focus()
  }, [mentorPanelExpanded])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [history, thinking])

  const buildSystemPrompt = () => {
    const ctx: string[] = []
    if (selectedNode) {
      ctx.push(`The user has selected a concept: "${selectedNode.data.text}" (confidence ${selectedNode.data.conf}/5, last reviewed ${selectedNode.data.reviewed} days ago).`)
    }
    if (selectedEdge) {
      const edgeType = selectedEdge.data?.type as EdgeTypeName
      const T = EDGE_TYPES[edgeType]
      const from = nodes.find(n => n.id === selectedEdge.source)
      const to = nodes.find(n => n.id === selectedEdge.target)
      ctx.push(`The user has selected a relation: "${from?.data.text}" → ${T.label} → "${to?.data.text}".`)
    }
    return [
      'You are Socrates, a Socratic mentor inside a knowledge graph for active learning called Nesso.',
      'Your purpose: probe, sharpen, and challenge the learner\'s understanding through short, pointed questions.',
      'Strict rules:',
      '— Never generate graph content for the user. Do not propose new nodes or edges yourself.',
      '— Prefer one short question over a paragraph of explanation.',
      '— If the learner asks for a fact, give it briefly, then return to a question.',
      '— Speak warmly but precisely. No emojis, no flattery.',
      '— Markdown emphasis: surround a key word with *asterisks* to highlight it.',
      '— Keep responses under 90 words.',
      ctx.length ? `Context:\n${ctx.join('\n')}` : '',
    ].filter(Boolean).join('\n')
  }

  const send = async (text: string) => {
    if (!text.trim() || thinking) return
    const next: Message[] = [...history, { role: 'user', text }]
    setHistory(next)
    setDraft('')
    setThinking(true)

    try {
      const client = new Anthropic({ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true })
      const messages = next.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.text,
      }))
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 256,
        system: buildSystemPrompt(),
        messages,
      })
      const reply = response.content[0].type === 'text' ? response.content[0].text : '…'
      setHistory(h => [...h, { role: 'mentor', text: reply }])
    } catch {
      setHistory(h => [...h, { role: 'mentor', text: '*Hmm.* My voice failed me. Try again — slowly.' }])
    } finally {
      setThinking(false)
    }
  }

  const unread = !mentorPanelExpanded && history.length > 0 && history[history.length - 1].role === 'mentor'
    ? history.filter(m => m.role === 'mentor').length
    : 0

  const promptHint = selectedNode
    ? `Ask Socrates about "${selectedNode.data.text}"…`
    : 'Ask Socrates anything…'

  return (
    <div style={{
      position: 'absolute',
      right: 22,
      bottom: 22,
      zIndex: 35,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 10,
    }}>
      {/* Card */}
      <div style={{
        width: 380,
        maxWidth: '86vw',
        maxHeight: '64vh',
        background: 'linear-gradient(180deg, var(--bg-card), var(--bg-elev))',
        border: '0.5px solid var(--line)',
        borderRadius: 18,
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        transform: mentorPanelExpanded ? 'none' : 'translateY(8px) scale(0.96)',
        opacity: mentorPanelExpanded ? 1 : 0,
        pointerEvents: mentorPanelExpanded ? 'auto' : 'none',
        transition: 'all 0.32s cubic-bezier(.4,.2,.2,1.05)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px 10px',
          borderBottom: '0.5px solid var(--line)',
        }}>
          <span style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--paper-deep)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <SocratesGlyph size={26} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
            <b style={{ font: "500 13px 'Fraunces', serif", letterSpacing: '-0.005em' }}>Socrates</b>
            <small style={{
              font: "500 10.5px 'JetBrains Mono', ui-monospace",
              color: 'var(--cat-causal)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <PulseDot />
              Mentor · live
            </small>
          </div>
          <button
            onClick={() => { setMentorPanelExpanded(false); setPromptSeed(i => i + 1) }}
            style={{
              appearance: 'none', border: 0, background: 'transparent',
              color: 'var(--ink-4)', cursor: 'default',
              width: 24, height: 24, borderRadius: 6,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)'; e.currentTarget.style.color = 'var(--ink)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-4)' }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12">
              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Conversation */}
        <div ref={scrollRef} style={{
          padding: '14px 16px 6px',
          overflowY: 'auto',
          flex: 1,
          minHeight: 80,
          scrollbarWidth: 'thin',
        }}>
          {history.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <span style={{
                  font: "500 13px/1.45 'Inter', system-ui",
                  color: 'var(--ink-2)',
                  padding: '7px 11px',
                  background: 'var(--paper-deep)',
                  borderRadius: '14px 14px 4px 14px',
                  marginLeft: 36,
                  border: '0.5px solid var(--line)',
                  display: 'inline-block',
                  maxWidth: '100%',
                }}>
                  {m.text}
                </span>
              </div>
            ) : (
              <p key={i} style={{
                font: "400 15px/1.5 'Fraunces', ui-serif, Georgia, serif",
                color: 'var(--ink)',
                letterSpacing: '-0.005em',
                margin: '0 0 14px',
              }}
                dangerouslySetInnerHTML={{ __html: emphasise(m.text) }}
              />
            )
          )}
          {thinking && (
            <div style={{ display: 'inline-flex', gap: 4, padding: '6px 0' }}>
              {[0, 150, 300].map(delay => (
                <span key={delay} style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'var(--ink-4)',
                  animation: `nx-think 1.2s ease-in-out ${delay}ms infinite`,
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          padding: '10px 10px 10px 16px',
          borderTop: '0.5px solid var(--line)',
        }}>
          <textarea
            ref={inputRef}
            value={draft}
            placeholder={promptHint}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft) }
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
              font: "400 14px/1.45 'Inter', system-ui",
              padding: '6px 0',
              maxHeight: 120,
              minHeight: 22,
            }}
          />
          <button
            onClick={() => send(draft)}
            disabled={!draft.trim() || thinking}
            style={{
              appearance: 'none',
              border: 0,
              background: 'var(--ink)',
              color: 'var(--paper)',
              width: 30,
              height: 30,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'default',
              flexShrink: 0,
              opacity: !draft.trim() || thinking ? 0.3 : 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 7h9M7.5 3l4 4-4 4" />
            </svg>
          </button>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setMentorPanelExpanded(!mentorPanelExpanded)}
        title="Socrates"
        style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--bg-elev)',
          color: 'var(--ink)',
          border: '0.5px solid var(--line)',
          boxShadow: 'var(--shadow-lg)',
          cursor: 'default',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <SpinRing />
        <SocratesGlyph size={42} />
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: 0, right: 0,
            minWidth: 16, height: 16,
            borderRadius: 999,
            background: 'var(--cat-causal)',
            color: 'var(--paper)',
            font: "600 10px 'JetBrains Mono', ui-monospace",
            padding: '0 4px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--bg-elev)',
          }}>
            {unread}
          </span>
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

function PulseDot() {
  return (
    <span style={{
      width: 5, height: 5, borderRadius: '50%',
      background: 'var(--cat-causal)',
      animation: 'nx-pulse 2.6s ease-in-out infinite',
      display: 'inline-block',
    }} />
  )
}

function SpinRing() {
  return (
    <span style={{
      position: 'absolute',
      inset: -3,
      borderRadius: '50%',
      border: '1px dashed var(--cat-causal)',
      opacity: 0.45,
      animation: 'nx-spin 28s linear infinite',
      pointerEvents: 'none',
    }} />
  )
}
