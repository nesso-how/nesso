import { useEffect, useRef, useSyncExternalStore } from 'react'
import { Button } from '@nesso/ui'
import { ArrowUp, ArrowUpRight, Check, MessageCircle, Square, X } from 'lucide-react'
import { defaultLocale } from '@nesso/i18n'
import type { createAiChat } from '@/ai/chat'
import { createAiApproval } from '@/ai/approval'
import { host, useNessoStore } from '@/store'
import { translate, useTranslation } from '@/i18n'

const outcomes = { applied: 'aiChatApplied', cancelled: 'aiChatCancelled', error: 'aiChatFailed' } as const
const starters = ['aiStarterAdd', 'aiStarterView', 'aiStarterConnections'] as const

export function Chat({ chat, draft, onDraftChange, onOpenSettings, activeModel }: {
  chat: ReturnType<typeof createAiChat>
  draft: string
  onDraftChange: (value: string) => void
  onOpenSettings: () => void
  activeModel: string | null
}) {
  const state = useSyncExternalStore(chat.subscribe, chat.getSnapshot)
  const messages = useNessoStore((state) => state.conversation.messages)
  const approval = useSyncExternalStore(chat.approvals.subscribe, chat.approvals.getSnapshot).find((item) => item.tone === 'confirmation')
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = useTranslation()
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const follow = useRef(true)
  const busy = state.phase !== 'idle'
  useEffect(() => {
    if (follow.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight
  }, [messages, state.phase, approval])
  useEffect(() => {
    if (!input.current) return
    input.current.style.height = 'auto'
    input.current.style.height = `${Math.min(140, Math.max(44, input.current.scrollHeight))}px`
  }, [draft])
  useEffect(() => { if (messages.length === 0) onDraftChange('') }, [messages, onDraftChange])
  const send = () => {
    if (!draft.trim() || busy) return
    follow.current = true
    void chat.send(draft, host, createAiApproval(chat.approvals.api, () => translate(host.store.getState().preferences.locale ?? defaultLocale)), locale)
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
            {starters.map((starter) => <Button key={starter} variant="ghost" className="chat-starter" onClick={() => { onDraftChange(t(`${starter}Prompt`)); input.current?.focus() }}><span>{t(starter)}</span><ArrowUpRight aria-hidden="true" /></Button>)}
          </div>
        </div>}
        <div className="chat-messages" role="log" aria-label={t('aiConversation')} aria-live="polite" aria-relevant="additions text">
          {messages.map((message, index) => <article key={message.id} className={`chat-message ${message.role}`} aria-label={t(message.role === 'user' ? 'aiYou' : 'aiAssistant')}>
            {message.content && <p>{message.content}</p>}
            {message.role === 'assistant' && index === messages.length - 1 && approval && <div className="chat-confirmation">
              <p>{approval.description}</p>
              <div className="chat-confirmation-actions">
                <Button size="sm" onClick={approval.action.onClick}>{approval.action.label}</Button>
                <Button variant="outline" size="sm" onClick={approval.cancelAction.onClick}>{t('aiKeep')}</Button>
              </div>
            </div>}
            {message.role === 'assistant' && (index !== messages.length - 1 || !busy) && message.outcome && message.outcome !== 'complete' && <div className="chat-outcome">
              {message.outcome === 'applied' ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}{t(outcomes[message.outcome])}
            </div>}
          </article>)}
        </div>
        {busy && state.phase !== 'approving' && <div role="status" className="chat-working"><span aria-hidden="true" />{t(state.phase === 'stopping' ? 'aiChatStopping' : 'aiChatWorking')}</div>}
        {state.issues.length > 0 && <p role="alert" className="mb-5 whitespace-pre-line text-xs text-destructive">{state.issues.map(({ message }) => message).join('\n')}</p>}
      </div>
      <div className="chat-composer-area">
        <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); send() }}>
          <textarea ref={input} aria-label={t('aiMessage')} placeholder={t('aiMessagePlaceholder')} value={draft} maxLength={16_000} rows={2}
            onChange={(event) => onDraftChange(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send() }
            }} />
          <div className="chat-composer-bottom">
            <span>{t('aiSendHint')}</span>
            {busy ? <Button type="button" size="icon-sm" className="chat-send" disabled={state.phase === 'stopping'} aria-label={t('aiStop')} title={t('aiStop')} onClick={chat.stop}><Square aria-hidden="true" /></Button>
              : <Button type="submit" size="icon-sm" className="chat-send" disabled={!draft.trim()} aria-label={t('aiSend')} title={t('aiSend')}><ArrowUp aria-hidden="true" /></Button>}
          </div>
        </form>
        <div className="chat-note"><button type="button" onClick={onOpenSettings}>{t('aiConfigure')}</button>{activeModel && <><span aria-hidden="true"> · </span><span title={activeModel}>{activeModel}</span></>}</div>
      </div>
    </section>
  )
}
