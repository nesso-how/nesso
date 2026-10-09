import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { isStepCount, streamText, type ToolSet } from 'ai'
import { aiChatInstructions, aiChatMessages, aiTools, type AiChatRequest, type AiChatEvent, type AiToolReply } from '@nesso/ai'
import type { createAiConnections } from './ai-connections.ts'
import { ElectronError } from './errors.ts'

type Connection = ReturnType<ReturnType<typeof createAiConnections>['active']>
const failure = () => new ElectronError([{ path: 'chat', message: 'Provider request failed or was incomplete. Check the connection and try again' }])

const modelFor = (entry: Connection, request: typeof fetch) => {
  const options = { apiKey: entry.apiKey, baseURL: entry.endpoint, fetch: request }
  switch (entry.provider) {
    case 'openai': return createOpenAI(options).responses(entry.model)
    case 'anthropic': return createAnthropic(options)(entry.model)
    case 'gemini': return createGoogleGenerativeAI(options)(entry.model.replace(/^models\//, ''))
    default: return createOpenAICompatible({ ...options, name: entry.provider }).chatModel(entry.model)
  }
}

export function createAiChatRun(entry: Connection, input: AiChatRequest, emit: (event: AiChatEvent) => void, request: typeof fetch = fetch) {
  const controller = new AbortController()
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(300_000)])
  const pending = new Map<string, (result: AiToolReply['result']) => void>()
  const tools: ToolSet = Object.fromEntries(Object.entries(aiTools).map(([name, definition]) => [name, {
    ...definition,
    strict: false,
    execute: (value: unknown, { toolCallId: callId }) => new Promise<unknown>((resolve, reject) => {
      signal.throwIfAborted()
      const finish = (result?: AiToolReply['result']) => {
        pending.delete(callId)
        signal.removeEventListener('abort', abort)
        if (!result || 'issues' in result) reject(failure())
        else resolve(result.value)
      }
      const abort = () => finish()
      pending.set(callId, finish)
      signal.addEventListener('abort', abort, { once: true })
      emit({ id: input.id, type: 'tool', callId, name, input: value })
    }),
  }]))
  const result = (async (): Promise<true> => {
    try {
      const safeRequest: typeof fetch = (url, options) => request(url, { ...options, redirect: 'error' })
      const stream = streamText({
        model: modelFor(entry, safeRequest), tools, abortSignal: signal,
        stopWhen: isStepCount(12), maxOutputTokens: 8192, maxRetries: 0,
        telemetry: { isEnabled: false }, onError: () => {},
        instructions: aiChatInstructions(input),
        messages: aiChatMessages(input),
      })
      let length = 0
      let complete = false
      for await (const part of stream.fullStream) {
        signal.throwIfAborted()
        if (part.type === 'text-delta') {
          length += part.text.length
          if (length > 100_000) throw failure()
          emit({ id: input.id, type: 'text', text: part.text })
        } else if (part.type === 'error' || part.type === 'tool-error' || part.type === 'abort') throw failure()
        else if (part.type === 'finish') complete = part.finishReason === 'stop'
      }
      if (!complete || signal.aborted) throw failure()
      return true
    } catch { throw failure() } finally { controller.abort() }
  })()
  return {
    id: input.id, result,
    cancel: () => controller.abort(),
    reply: (reply: AiToolReply) => { if (reply.id === input.id) pending.get(reply.callId)?.(reply.result) },
  }
}
