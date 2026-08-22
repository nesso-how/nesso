// SPDX-License-Identifier: MIT
import { useState, useEffect, useCallback, useRef } from 'react'
import { SocratesGlyph } from './SocratesGlyph'
import { useGraphStore } from '@/store'
import type { ChatMessage, CompletionHandlers } from '@/llm/completion'
import {
  describeCompletionError,
  fetchCompletion,
  isAiReady,
  isNetworkFailure,
  isToolCompatibilityFailure,
} from '@/llm/completion'
import { buildLegacyMentorPrompt, buildMentorPrompt, buildMentorSeedText } from '@/llm/context'
import { createMentorTools, MENTOR_TOOL_NAMES, type MentorToolName } from '@/llm/tools'
import { useT } from '@/i18n'
import { CloseButton } from '@/components/ui/CloseButton'
import { STATUS_BAR_HEIGHT_PX } from '@/components/layout/StatusBar'
import { ThinkingIndicator } from './ThinkingIndicator'
import { renderWithEmphasis } from './emphasis'
import { track, toCountBucket } from '@/telemetry'

interface Message {
  role: 'user' | 'mentor'
  text: string
  /** Rendered as a technical error rather than a Socrates reply. */
  error?: boolean
}

/**
 * The mentor is experimental and its users are technical, so surface the real error.
 * A connection failure keeps the actionable hint (check Settings, run `ollama serve`)
 * with the raw detail appended; other failures show the detail alone.
 */
function mentorFailureMessage(err: unknown, t: ReturnType<typeof useT>): string {
  const detail = describeCompletionError(err)
  return isNetworkFailure(err) ? `${t.mentor.errorConnection}\n\n${detail}` : detail
}

/** Grows the last mentor bubble (or starts one) with an answer delta. */
function appendToLastMentor(history: Message[], delta: string): Message[] {
  const last = history[history.length - 1]
  if (!last || last.role !== 'mentor') return [...history, { role: 'mentor', text: delta }]
  return [...history.slice(0, -1), { ...last, text: last.text + delta }]
}

function isActiveController(current: AbortController | null, controller: AbortController): boolean {
  return current === controller && !controller.signal.aborted
}

const MENTOR_TOOL_NAME_SET = new Set<string>(MENTOR_TOOL_NAMES)

function isMentorToolName(value: string): value is MentorToolName {
  return MENTOR_TOOL_NAME_SET.has(value)
}

function MentorUserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '5px 0' }}>
      <span
        style={{
          fontSize: '13px',
          fontWeight: 500,
          lineHeight: 1.45,
          fontFamily: 'var(--font-sans)',
          color: 'var(--ink-2)',
          padding: '7px 11px',
          background: 'var(--paper-deep)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)',
          marginLeft: 36,
          border: '0.5px solid var(--line)',
          display: 'inline-block',
          maxWidth: '100%',
        }}
      >
        {text}
      </span>
    </div>
  )
}

function MentorErrorBubble({ text }: { text: string }) {
  return (
    <div
      style={{
        fontSize: '12px',
        fontWeight: 400,
        lineHeight: 1.5,
        fontFamily: 'var(--font-mono)',
        color: 'var(--ink-3)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        margin: '5px 0',
        padding: '8px 10px',
        background: 'var(--paper-deep)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      {text}
    </div>
  )
}

function MentorReplyBubble({ text, showCaret }: { text: string; showCaret: boolean }) {
  return (
    <div
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
      {renderWithEmphasis(text)}
      {showCaret && (
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
  )
}

function MentorActivityStatus({ label }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      <ThinkingIndicator label={label} />
    </div>
  )
}

function MentorChatMessage({
  message,
  index,
  historyLength,
  streaming,
}: {
  message: Message
  index: number
  historyLength: number
  streaming: boolean
}) {
  if (message.role === 'user') return <MentorUserBubble text={message.text} />
  if (message.error) return <MentorErrorBubble text={message.text} />
  return (
    <MentorReplyBubble text={message.text} showCaret={streaming && index === historyLength - 1} />
  )
}

function toConversation(msgs: Message[]): ChatMessage[] {
  return msgs.map((m) => ({
    role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
    content: m.text,
  }))
}

/**
 * Output ceiling, not a target: reply length is soft-capped at ~200 words in
 * the mentor persona. Headroom is generous so reasoning models (e.g. qwen3 thinking
 * mode) can spend tokens on their hidden reasoning and still emit a full answer
 * within the same budget.
 */
const MENTOR_MAX_TOKENS = 2048

const MENTOR_TOOLS = createMentorTools(useGraphStore.getState)

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
  /** True once reasoning deltas are streaming in but the answer hasn't started yet. */
  const [reasoningActive, setReasoningActive] = useState(false)
  const [toolAction, setToolAction] = useState<MentorToolName | null>(null)
  const [chatKey, setChatKey] = useState(0)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const legacyModeRef = useRef(false)
  const userMessageCountRef = useRef(0)
  const historyRef = useRef(history)
  historyRef.current = history

  const captureTurn = useCallback(() => {
    const state = useGraphStore.getState()
    const selection = state.selected ? { ...state.selected } : null
    return {
      seedText: buildMentorSeedText(state.settings.language, state.nodes, state.edges, selection),
      compactInstructions: buildMentorPrompt(
        state.nodes,
        state.edges,
        selection,
        state.settings.language,
      ),
      buildLegacyInstructions: () =>
        buildLegacyMentorPrompt(state.nodes, state.edges, selection, state.settings.language),
    }
  }, [])

  const completeTurn = useCallback(
    async (
      messages: ChatMessage[],
      prompts: ReturnType<typeof captureTurn>,
      controller: AbortController,
      handlers: CompletionHandlers,
      hasVisibleText: () => boolean,
    ): Promise<string> => {
      const attempt = (legacy: boolean) =>
        fetchCompletion(
          settings,
          {
            instructions: legacy ? prompts.buildLegacyInstructions() : prompts.compactInstructions,
            messages,
            ...(legacy ? {} : { tools: MENTOR_TOOLS }),
          },
          MENTOR_MAX_TOKENS,
          controller.signal,
          handlers,
        )

      if (legacyModeRef.current) return attempt(true)
      try {
        return await attempt(false)
      } catch (error) {
        if (controller.signal.aborted || hasVisibleText() || !isToolCompatibilityFailure(error)) {
          throw error
        }
        legacyModeRef.current = true
        setReasoningActive(false)
        setToolAction(null)
        return attempt(true)
      }
    },
    [settings, captureTurn],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: opening line tied to graph open/switch; live sends use fresh prompts via captureTurn
  useEffect(() => {
    if (!mentorPanelExpanded) return
    legacyModeRef.current = false
    setToolAction(null)
    if (!aiReady) {
      abortRef.current?.abort()
      abortRef.current = null
      setHistory([{ role: 'mentor', text: t.mentor.needsSetup }])
      setStreaming(false)
      setThinking(false)
      setLoadingInitial(false)
      setReasoningActive(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setHistory([])
    setStreaming(false)
    setThinking(false)
    setLoadingInitial(true)
    setReasoningActive(false)

    const prompts = captureTurn()

    let answered = false
    completeTurn(
      [{ role: 'user', content: prompts.seedText }],
      prompts,
      controller,
      {
        onToken: (delta) => {
          if (!isActiveController(abortRef.current, controller)) return
          setToolAction(null)
          if (!answered) {
            answered = true
            setLoadingInitial(false)
            setReasoningActive(false)
            setStreaming(true)
          }
          setHistory((h) => appendToLastMentor(h, delta))
        },
        onToolCall: (toolName) => {
          if (!isActiveController(abortRef.current, controller)) return
          if (!isMentorToolName(toolName)) return
          setToolAction(toolName)
        },
        onReasoning: () => {
          if (!isActiveController(abortRef.current, controller)) return
          setReasoningActive(true)
        },
      },
      () => answered,
    )
      .then((full) => {
        if (isActiveController(abortRef.current, controller) && !answered) {
          setReasoningActive(false)
          setHistory((h) => appendToLastMentor(h, full || '…'))
        }
      })
      .catch((err) => {
        if (isActiveController(abortRef.current, controller)) {
          setToolAction(null)
          setHistory([{ role: 'mentor', text: mentorFailureMessage(err, t), error: true }])
          track({
            name: 'mentor_request_failed',
            props: { reason: isNetworkFailure(err) ? 'network' : 'response' },
          })
        }
      })
      .finally(() => {
        if (isActiveController(abortRef.current, controller)) {
          setLoadingInitial(false)
          setStreaming(false)
          setToolAction(null)
        }
      })

    return () => {
      controller.abort()
      abortRef.current?.abort()
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [
    mentorPanelExpanded,
    currentGraphId,
    aiReady,
    settings.language,
    settings.aiBaseUrl,
    settings.aiModel,
    chatKey,
    captureTurn,
  ])

  // Emit mentor_session_completed when the session ends naturally (last
  // message was a successful mentor reply) or mentor_session_abandoned
  // otherwise. Resets the user-message count on each new session.
  useEffect(() => {
    if (!mentorPanelExpanded) return
    userMessageCountRef.current = 0
    return () => {
      if (userMessageCountRef.current <= 0) return
      const bucket = toCountBucket(userMessageCountRef.current)
      const last = historyRef.current[historyRef.current.length - 1]
      if (last?.role === 'mentor' && !last.error) {
        track({ name: 'mentor_session_completed', props: { message_count_bucket: bucket } })
      } else {
        track({ name: 'mentor_session_abandoned', props: { message_count_bucket: bucket } })
      }
    }
  }, [
    mentorPanelExpanded,
    currentGraphId,
    aiReady,
    settings.language,
    settings.aiBaseUrl,
    settings.aiModel,
    chatKey,
  ])

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
    setToolAction(null)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const next: Message[] = [...history, { role: 'user', text }]
    setHistory(next)
    setDraft('')
    setThinking(true)
    setReasoningActive(false)
    track({ name: 'mentor_message_sent' })
    userMessageCountRef.current += 1
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
    const prompts = captureTurn()
    let answered = false
    try {
      const full = await completeTurn(
        toConversation(next),
        prompts,
        controller,
        {
          onToken: (delta) => {
            if (!isActiveController(abortRef.current, controller)) return
            setToolAction(null)
            if (!answered) {
              answered = true
              setThinking(false)
              setReasoningActive(false)
              setStreaming(true)
            }
            setHistory((h) => appendToLastMentor(h, delta))
          },
          onToolCall: (toolName) => {
            if (!isActiveController(abortRef.current, controller)) return
            if (!isMentorToolName(toolName)) return
            setToolAction(toolName)
          },
          onReasoning: () => {
            if (!isActiveController(abortRef.current, controller)) return
            setReasoningActive(true)
          },
        },
        () => answered,
      )
      if (isActiveController(abortRef.current, controller) && !answered) {
        setReasoningActive(false)
        setHistory((h) => appendToLastMentor(h, full || '…'))
      }
      if (isActiveController(abortRef.current, controller)) {
        track({ name: 'mentor_response_received' })
      }
    } catch (err) {
      if (isActiveController(abortRef.current, controller)) {
        setToolAction(null)
        setHistory((h) => [
          ...h,
          { role: 'mentor', text: mentorFailureMessage(err, t), error: true },
        ])
        track({
          name: 'mentor_request_failed',
          props: { reason: isNetworkFailure(err) ? 'network' : 'response' },
        })
      }
    } finally {
      if (isActiveController(abortRef.current, controller)) {
        setStreaming(false)
        setThinking(false)
        setToolAction(null)
      }
    }
  }

  const thinkingLabel = toolAction
    ? t.mentor.toolActions[toolAction]
    : reasoningActive
      ? t.mentor.thinking
      : undefined
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
            title={t.mentor.newChat}
            onClick={() => {
              setToolAction(null)
              abortRef.current?.abort()
              legacyModeRef.current = false
              setChatKey((k) => k + 1)
            }}
            style={{
              appearance: 'none',
              border: 0,
              background: 'transparent',
              color: 'var(--ink-4)',
              cursor: 'pointer',
              width: 24,
              height: 24,
              borderRadius: 'var(--radius-pill)',
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
          <CloseButton
            onClick={() => {
              setToolAction(null)
              abortRef.current?.abort()
              legacyModeRef.current = false
              setMentorPanelExpanded(false)
            }}
          />
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
            <MentorActivityStatus label={thinkingLabel} />
          ) : (
            history.map((m, i) => (
              <MentorChatMessage
                key={i}
                message={m}
                index={i}
                historyLength={history.length}
                streaming={streaming}
              />
            ))
          )}
          {thinking && <MentorActivityStatus label={thinkingLabel} />}
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
