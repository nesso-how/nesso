import { useEffect, useRef, useSyncExternalStore } from 'react'
import { Button } from '@nesso-how/ui'
import { ArrowUp, ArrowUpRight, Check, MessageCircle, Redo2, Square, Undo2, X } from 'lucide-react'
import { defaultLocale } from '@nesso-how/i18n'
import type { aiTools, AiChatMessage } from '@nesso-how/ai'
import type { createAiChat } from '@/ai/chat'
import { host, useNessoStore } from '@/store'
import type { HostStore } from '@/store/types'
import { useTranslation } from '@/i18n'
import { notifications } from '@/notifications'
import { ChatMarkdown } from './ChatMarkdown'

const outcomes = { applied: 'aiChatApplied', cancelled: 'aiChatCancelled', error: 'aiChatFailed' } as const
const starters = ['aiStarterHelp', 'aiStarterAnalysis', 'aiStarterAdd', 'aiStarterView'] as const
const activities = {
  read_docs: 'aiChatReadingDocs', context: 'aiChatReadingContext', concepts: 'aiChatReadingConcepts',
  relations: 'aiChatReadingRelations', views: 'aiChatReadingViews', relation_types: 'aiChatReadingRelationTypes',
  selection: 'aiChatReadingSelection', edit: 'aiChatPreparingEdits', history: 'aiChatPreparingHistory',
} as const satisfies Record<keyof typeof aiTools, string>

const describeChanges = (summary: NonNullable<AiChatMessage['summary']>, t: ReturnType<typeof useTranslation>): string => {
  const parts: string[] = []
  if (summary.added > 0) parts.push(t('aiChangeAdded', { count: summary.added }))
  if (summary.updated > 0) parts.push(t('aiChangeUpdated', { count: summary.updated }))
  if (summary.removed > 0) parts.push(t('aiChangeRemoved', { count: summary.removed }))
  if (summary.memberships > 0) parts.push(t('aiChangeMembership', { count: summary.memberships }))
  return parts.join(' · ')
}

export function Chat({ chat, draft, onDraftChange, onOpenSettings, activeModel, store = host.store, readonly = false }: {
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
  for (const message of messages) if (message.role === 'assistant' && message.outcome === 'applied') lastAppliedId = message.id
  const usageLimit = !readonly && state.issues.some(({ path }) => path === 'chatgpt.usage')
  const manageUsage = async () => {
    try {
      const result = await window.nessoAi?.manageUsage()
      if (result && !('issues' in result)) return
    } catch {}
    notifications.api.notify({ tone: 'warning', title: t('aiUsageOpenFailed') })
  }
  useEffect(() => {
    if (follow.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight
  }, [messages, state.phase, state.tool])
  useEffect(() => {
    if (!input.current) return
    input.current.style.height = 'auto'
    input.current.style.height = `${Math.min(140, Math.max(44, input.current.scrollHeight))}px`
  }, [draft])
  useEffect(() => { if (messages.length === 0) onDraftChange('') }, [messages, onDraftChange])
  const send = () => {
    if (readonly || !draft.trim() || busy) return
    follow.current = true
    void chat.send(draft, host, locale)
    onDraftChange('')
  }
  return (
    <section aria-label={t('chat')} className="chat-panel">
      <div ref={scroller} className="chat-scroll" onScroll={(event) => {
        const element = event.currentTarget
        follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48
      }}>
        {messages.length === 0 && <div className="chat-empty">
          <MessageCircle className="chat-empty-mark" aria-hidden="true" />
          <h1>{t('aiChatTitle')}</h1>
          <p>{t('aiChatEmpty')}</p>
          <div className="chat-starters" aria-label={t('aiStarterPrompts')}>
             {starters.map((starter) => <Button key={starter} disabled={readonly} variant="ghost" className="chat-starter" onClick={() => { onDraftChange(t(`${starter}Prompt`)); input.current?.focus() }}><span>{t(starter)}</span><ArrowUpRight aria-hidden="true" /></Button>)}
          </div>
        </div>}
        <div className="chat-messages" role="log" aria-label={t('aiConversation')} aria-live="polite" aria-relevant="additions text">
          {messages.map((message, index) => <article key={message.id} className={`chat-message ${message.role}`} aria-label={t(message.role === 'user' ? 'aiYou' : 'aiAssistant')}>
            {message.content && (message.role === 'assistant' ? <ChatMarkdown content={message.content} /> : <p>{message.content}</p>)}
            {message.role === 'assistant' && (index !== messages.length - 1 || !busy) && message.outcome && message.outcome !== 'complete' && <div className="chat-outcome">
              {message.outcome === 'applied' ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}{t(outcomes[message.outcome])}
              {message.outcome === 'applied' && message.summary ? <span>{describeChanges(message.summary, t)}</span> : null}
            </div>}
            {!readonly && !busy && (canUndo || canRedo) && message.role === 'assistant' && message.outcome === 'applied' && message.id === lastAppliedId && <div className="chat-confirmation-actions">
              {canUndo && <Button type="button" size="sm" variant="outline" title={t('aiUndoTitle')} aria-label={t('aiUndoTitle')} onClick={() => store.undo()}><Undo2 aria-hidden="true" />{t('aiUndo')}</Button>}
              {canRedo && <Button type="button" size="sm" variant="outline" title={t('aiRedoTitle')} aria-label={t('aiRedoTitle')} onClick={() => store.redo()}><Redo2 aria-hidden="true" />{t('aiRedo')}</Button>}
            </div>}
          </article>)}
        </div>
        {busy && <div role="status" className="chat-working"><span aria-hidden="true" />{t(state.phase === 'stopping' ? 'aiChatStopping' : state.tool ? activities[state.tool] : 'aiChatWorking')}</div>}
        {!readonly && state.issues.length > 0 && <p role="alert" className="mb-5 whitespace-pre-line text-xs text-destructive">{state.issues.map(({ message }) => message).join('\n')}</p>}
        {usageLimit && <div className="mb-5"><Button size="sm" onClick={() => void manageUsage()}>{t('aiManageUsage')}</Button></div>}
      </div>
      <div className="chat-composer-area">
        <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); send() }}>
          <textarea ref={input} readOnly={readonly} aria-label={t('aiMessage')} placeholder={t('aiMessagePlaceholder')} value={draft} maxLength={16_000} rows={2}
            onChange={(event) => onDraftChange(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send() }
            }} />
          <div className="chat-composer-bottom">
            <span>{t('aiSendHint')}</span>
            {busy ? <Button type="button" size="icon-sm" className="chat-send" disabled={state.phase === 'stopping'} aria-label={t('aiStop')} title={t('aiStop')} onClick={chat.stop}><Square aria-hidden="true" /></Button>
              : <Button type="submit" size="icon-sm" className="chat-send" disabled={readonly || !draft.trim()} aria-label={t('aiSend')} title={t('aiSend')}><ArrowUp aria-hidden="true" /></Button>}
          </div>
        </form>
        <div className="chat-note"><button type="button" disabled={readonly || !onOpenSettings} onClick={onOpenSettings}>{t('aiConfigure')}</button>{activeModel && <><span aria-hidden="true"> · </span><span title={activeModel}>{activeModel}</span></>}</div>
      </div>
    </section>
  )
}
