import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button, IconButton } from '@nesso-how/ui'
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  Copy,
  MessageCircle,
  Redo2,
  RotateCcw,
  Square,
  Undo2,
  X,
} from 'lucide-react'
import { defaultLocale } from '@nesso-how/i18n'
import type { aiTools, AiChatMessage } from '@nesso-how/ai'
import type { createAiChat } from '@/ai/chat'
import { host, useNessoStore } from '@/store'
import type { HostStore } from '@/store/types'
import { useTranslation } from '@/i18n'
import { notifications } from '@/notifications'
import { ChatMarkdown } from './ChatMarkdown'

const outcomes = {
  applied: 'aiChatApplied',
  cancelled: 'aiChatCancelled',
  error: 'aiChatFailed',
} as const
const issueKeys = [
  'aiChatProviderFailed',
  'aiChatAuthenticationFailed',
  'aiChatUsageUnavailable',
  'aiChatLimitReached',
  'storageBusy',
] as const
const starters = ['aiStarterHelp', 'aiStarterAnalysis', 'aiStarterAdd', 'aiStarterView'] as const
const activities = {
  read_docs: 'aiChatReadingDocs',
  context: 'aiChatReadingContext',
  concepts: 'aiChatReadingConcepts',
  relations: 'aiChatReadingRelations',
  views: 'aiChatReadingViews',
  relation_types: 'aiChatReadingRelationTypes',
  selection: 'aiChatReadingSelection',
  edit: 'aiChatPreparingEdits',
  history: 'aiChatPreparingHistory',
} as const satisfies Record<keyof typeof aiTools, string>

const describeStats = (
  stats: NonNullable<AiChatMessage['stats']>,
  locale: string,
  t: ReturnType<typeof useTranslation>,
): string => {
  const parts = [
    new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'second',
      unitDisplay: 'narrow',
      maximumFractionDigits: 1,
    }).format(stats.durationMs / 1000),
  ]
  if (stats.totalTokens !== undefined)
    parts.push(
      t('aiMessageTokens', {
        count: stats.totalTokens,
        tokens: new Intl.NumberFormat(locale).format(stats.totalTokens),
      }),
    )
  return parts.join(' · ')
}

const describeChanges = (
  summary: NonNullable<AiChatMessage['summary']>,
  t: ReturnType<typeof useTranslation>,
): string => {
  const parts: string[] = []
  if (summary.added > 0) parts.push(t('aiChangeAdded', { count: summary.added }))
  if (summary.updated > 0) parts.push(t('aiChangeUpdated', { count: summary.updated }))
  if (summary.removed > 0) parts.push(t('aiChangeRemoved', { count: summary.removed }))
  if (summary.memberships > 0) parts.push(t('aiChangeMembership', { count: summary.memberships }))
  return parts.join(' · ')
}

function CopyResponse({ content, t }: { content: string; t: ReturnType<typeof useTranslation> }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  if (!content) return null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
      notifications.api.notify({ tone: 'warning', title: t('aiCopyFailed') })
    }
  }
  return (
    <MessageAction label={t(copied ? 'copied' : 'aiCopyResponse')} onClick={() => void copy()}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </MessageAction>
  )
}

function MessageAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <IconButton className="chat-action" aria-label={label} title={label} onClick={onClick}>
      {children}
    </IconButton>
  )
}

export function Chat({
  chat,
  draft,
  onDraftChange,
  onOpenSettings,
  activeModel,
  store = host.store,
  readonly = false,
}: {
  chat: ReturnType<typeof createAiChat>
  draft: string
  onDraftChange: (value: string) => void
  onOpenSettings?: () => void
  activeModel: string | null
  store?: HostStore
  readonly?: boolean
}) {
  const state = useSyncExternalStore(chat.subscribe, chat.getSnapshot)
  const messages = useNessoStore((state) => state.conversation.messages, store)
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale, store)
  const t = useTranslation(store)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const follow = useRef(true)
  const busy = !readonly && state.phase !== 'idle'
  const canUndo = useNessoStore((state) => state.history.canUndo, store)
  const canRedo = useNessoStore((state) => state.history.canRedo, store)
  let lastAppliedId: string | undefined
  for (const message of messages)
    if (message.role === 'assistant' && message.outcome === 'applied') lastAppliedId = message.id
  const lastOutcome = messages.at(-1)?.outcome
  const editable = !readonly && !busy
  const retryable = editable && (lastOutcome === 'error' || lastOutcome === 'cancelled')
  const issues =
    !readonly &&
    state.issues
      .map(({ message }) => {
        const key = issueKeys.find((key) => key === message)
        return key ? t(key) : message
      })
      .join('\n')
  const turnIssues =
    retryable &&
    lastOutcome === 'error' &&
    state.issues.every(({ path }) => path !== 'ai.limit') &&
    issues
  const usageLimit = !readonly && state.issues.some(({ path }) => path === 'chatgpt.usage')
  const manageUsage = async () => {
    try {
      const result = await window.nessoAi?.manageUsage()
      if (result && !('issues' in result)) return
    } catch {}
    notifications.api.notify({ tone: 'warning', title: t('aiUsageOpenFailed') })
  }
  useEffect(() => {
    if (follow.current && scroller.current)
      scroller.current.scrollTop = scroller.current.scrollHeight
  }, [messages, state.phase, state.tool])
  useEffect(() => {
    if (!input.current) return
    input.current.style.height = 'auto'
    input.current.style.height = `${Math.min(140, Math.max(44, input.current.scrollHeight))}px`
  }, [draft])
  useEffect(() => {
    if (messages.length === 0) onDraftChange('')
  }, [messages, onDraftChange])
  const send = () => {
    if (readonly || !draft.trim() || busy) return
    follow.current = true
    void chat.send(draft, host, locale)
    onDraftChange('')
  }
  const retry = () => {
    follow.current = true
    void chat.retry(host, locale)
  }
  return (
    <section aria-label={t('chat')} className="chat-panel">
      <div
        ref={scroller}
        className="chat-scroll nesso-scroll"
        onScroll={(event) => {
          const element = event.currentTarget
          follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48
        }}
      >
        {messages.length === 0 && (
          <div className="chat-empty">
            <MessageCircle className="chat-empty-mark" aria-hidden="true" />
            <h1>{t('aiChatTitle')}</h1>
            <p>{t('aiChatEmpty')}</p>
            <div className="chat-starters" aria-label={t('aiStarterPrompts')}>
              {starters.map((starter) => (
                <Button
                  key={starter}
                  disabled={readonly}
                  variant="ghost"
                  className="chat-starter"
                  onClick={() => {
                    onDraftChange(t(`${starter}Prompt`))
                    input.current?.focus()
                  }}
                >
                  <span>{t(starter)}</span>
                  <ArrowUpRight aria-hidden="true" />
                </Button>
              ))}
            </div>
          </div>
        )}
        <div
          className="chat-messages"
          role="log"
          aria-label={t('aiConversation')}
          aria-live="polite"
          aria-relevant="additions text"
        >
          {messages.map((message, index) => {
            const settled = message.role === 'assistant' && (index !== messages.length - 1 || !busy)
            return (
              <article
                key={message.id}
                className={`chat-message ${message.role}`}
                aria-label={t(message.role === 'user' ? 'aiYou' : 'aiAssistant')}
              >
                {message.content &&
                  (message.role === 'assistant' ? (
                    <ChatMarkdown content={message.content} />
                  ) : (
                    <p>{message.content}</p>
                  ))}
                {settled && message.outcome && message.outcome !== 'complete' && (
                  <div className="chat-outcome">
                    {message.outcome === 'applied' ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <X aria-hidden="true" />
                    )}
                    {t(outcomes[message.outcome])}
                    {message.outcome === 'applied' && message.summary ? (
                      <span>{describeChanges(message.summary, t)}</span>
                    ) : null}
                  </div>
                )}
                {turnIssues && index === messages.length - 1 && (
                  <p role="alert" className="chat-outcome-detail">
                    {turnIssues}
                  </p>
                )}
                {editable &&
                  (canUndo || canRedo) &&
                  message.role === 'assistant' &&
                  message.outcome === 'applied' &&
                  message.id === lastAppliedId && (
                    <div className="chat-confirmation-actions">
                      {canUndo && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          title={t('aiUndoTitle')}
                          aria-label={t('aiUndoTitle')}
                          onClick={() => store.undo()}
                        >
                          <Undo2 aria-hidden="true" />
                          {t('aiUndo')}
                        </Button>
                      )}
                      {canRedo && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          title={t('aiRedoTitle')}
                          aria-label={t('aiRedoTitle')}
                          onClick={() => store.redo()}
                        >
                          <Redo2 aria-hidden="true" />
                          {t('aiRedo')}
                        </Button>
                      )}
                    </div>
                  )}
                {settled && (
                  <div className="chat-message-actions">
                    {retryable && index === messages.length - 1 && (
                      <MessageAction label={t('aiRetry')} onClick={retry}>
                        <RotateCcw aria-hidden="true" />
                      </MessageAction>
                    )}
                    <div className="chat-message-secondary">
                      <CopyResponse content={message.content} t={t} />
                      {message.stats && (
                        <span className="chat-message-stats" title={t('aiMessageStats')}>
                          {describeStats(message.stats, locale, t)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
        {busy && (
          <div role="status" className="chat-working">
            <span aria-hidden="true" />
            {t(
              state.phase === 'stopping'
                ? 'aiChatStopping'
                : state.tool
                  ? activities[state.tool]
                  : 'aiChatWorking',
            )}
          </div>
        )}
        {issues && !turnIssues && (
          <p role="alert" className="mb-5 whitespace-pre-line text-xs text-destructive">
            {issues}
          </p>
        )}
        {usageLimit && (
          <div className="mb-5">
            <Button size="sm" onClick={() => void manageUsage()}>
              {t('aiManageUsage')}
            </Button>
          </div>
        )}
      </div>
      <div className="chat-composer-area">
        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault()
            send()
          }}
        >
          <textarea
            ref={input}
            className="nesso-scroll"
            readOnly={readonly}
            aria-label={t('aiMessage')}
            placeholder={t('aiMessagePlaceholder')}
            value={draft}
            maxLength={16_000}
            rows={2}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                send()
              }
            }}
          />
          <div className="chat-composer-bottom">
            <span>{t('aiSendHint')}</span>
            {busy ? (
              <Button
                type="button"
                size="icon-sm"
                className="chat-send"
                disabled={state.phase === 'stopping'}
                aria-label={t('aiStop')}
                title={t('aiStop')}
                onClick={chat.stop}
              >
                <Square aria-hidden="true" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon-sm"
                className="chat-send"
                disabled={readonly || !draft.trim()}
                aria-label={t('aiSend')}
                title={t('aiSend')}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
            )}
          </div>
        </form>
        <div className="chat-note">
          <button type="button" disabled={readonly || !onOpenSettings} onClick={onOpenSettings}>
            {t('aiConfigure')}
          </button>
          {activeModel && (
            <>
              <span aria-hidden="true"> · </span>
              <span title={activeModel}>{activeModel}</span>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
