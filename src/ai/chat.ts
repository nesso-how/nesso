import type { AiChatMessage, AiChatRequest } from '@nesso/ai'
import type { AiBridge } from '../../electron/ai-bridge.ts'
import { NessoError } from '../store/errors.ts'
import { createAiTurn } from './turn.ts'
import { createNotifications } from '../notifications/create.ts'
import type { HostStore } from '../store/types.ts'

type Snapshot = {
  readonly phase: 'idle' | 'generating' | 'approving' | 'stopping'
  readonly issues: readonly { path: string; message: string }[]
}

export function createAiChat(bridge: Pick<AiBridge, 'chat' | 'stop' | 'reply' | 'subscribeChat'>, store: HostStore) {
  const approvals = createNotifications()
  let state: Snapshot = { phase: 'idle', issues: [] }
  let active: { id: string; messageId: string; controller: AbortController; turn: ReturnType<typeof createAiTurn>; historyAvailable: boolean; failure?: NessoError } | undefined
  const listeners = new Set<() => void>()
  const publish = (next: Snapshot) => {
    state = next
    for (const listener of listeners) listener()
  }
  const update = (id: string, change: (message: AiChatMessage) => AiChatMessage) => {
    const messages = store.getState().conversation.messages
    if (messages.some((message) => message.id === id)) store.setChatMessages(messages.map((message) => message.id === id ? change(message) : message))
  }
  const stop = () => {
    if (!active || active.controller.signal.aborted) return
    active.controller.abort()
    bridge.stop(active.id)
    publish({ ...state, phase: 'stopping' })
  }
  let conversation = store.getState().conversation
  const unsubscribeStore = store.subscribe(() => {
    const next = store.getState().conversation
    if (next === conversation) return
    conversation = next
    if (next.messages.length === 0) {
      stop()
      publish({ ...state, issues: [] })
    }
  })
  const unsubscribe = bridge.subscribeChat((event) => {
    const run = active
    if (!run || run.id !== event.id || run.controller.signal.aborted) return
    try {
      if (event.type === 'text') update(run.messageId, (message) => ({ ...message, content: message.content + event.text }))
      else {
        const value = run.turn.execute(event.name, event.input)
        if (event.name === 'history' && 'available' in value) run.historyAvailable = value.available
        bridge.reply({ id: run.id, callId: event.callId, result: { value } })
      }
    } catch (error) {
      run.failure = error instanceof NessoError ? error : new NessoError([{ path: 'ai.chat', message: 'Chat response failed validation' }])
      if (event.type === 'tool') bridge.reply({ id: run.id, callId: event.callId, result: { issues: run.failure.issues } })
      stop()
    }
  })
  const clear = () => {
    stop()
    store.clearChat()
    publish({ ...state, issues: [] })
  }
  return {
    approvals,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    stop, clear,
    dispose: () => { stop(); unsubscribe(); unsubscribeStore() },
    send: async (content: string, boundary: Parameters<typeof createAiTurn>[0], approve: Parameters<typeof createAiTurn>[1], locale: AiChatRequest['locale']) => {
      const text = content.trim()
      if (!text || active) return
      const messages = store.getState().conversation.messages
      if (text.length > 100_000 || messages.length > 498) {
        publish({ ...state, issues: [{ path: 'ai.chat', message: 'Conversation limit reached. Clear the chat to start again' }] })
        return
      }
      const controller = new AbortController()
      const turn = createAiTurn(boundary, (effects, signal) => {
        publish({ ...state, phase: 'approving' })
        return approve(effects, signal)
      }, controller.signal)
      const run = { id: crypto.randomUUID(), messageId: crypto.randomUUID(), controller, turn, historyAvailable: false, failure: undefined as NessoError | undefined }
      active = run
      const history = [...messages, { id: crypto.randomUUID(), role: 'user' as const, content: text }]
      store.setChatMessages([...history, { id: run.messageId, role: 'assistant', content: '', outcome: 'cancelled' }])
      publish({ ...state, phase: 'generating', issues: [] })
      let outcome: AiChatMessage['outcome'] = 'cancelled'
      try {
        const result = await bridge.chat({ id: run.id, messages: history, context: JSON.stringify(turn.execute('context', {})), locale })
        if (run.failure) throw run.failure
        if (controller.signal.aborted) return
        if ('issues' in result) throw new NessoError([...result.issues])
        const commit = await turn.commit()
        const { effects } = commit
        const changed = run.historyAvailable || effects.memberships > 0
          || [effects.concepts, effects.relations, effects.relationTypes, effects.views].some((group) => group.added + group.updated + group.removed > 0)
        outcome = commit.status === 'cancelled' ? 'cancelled' : changed ? 'applied' : 'complete'
      } catch (error) {
        if (run.failure || !controller.signal.aborted) {
          outcome = 'error'
          const issues = error instanceof NessoError ? error.issues : [{ path: 'ai.chat', message: 'Chat request failed; no changes were applied' }]
          publish({ ...state, issues })
        }
      } finally {
        turn.cancel()
        update(run.messageId, (message) => ({ ...message, outcome }))
        active = undefined
        publish({ ...state, phase: 'idle' })
      }
    },
  }
}
