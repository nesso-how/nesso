// SPDX-License-Identifier: MIT
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { APICallError, extractReasoningMiddleware, streamText, wrapLanguageModel } from 'ai'
import type { NessoSettings } from '@/types/graph'

/** A chat turn. The system prompt is passed separately as `instructions`, never as a role here. */
export type ChatMessage = { role: 'user' | 'assistant'; content: string }

/** A completion request: the system prompt (`instructions`) plus the user/assistant turns. */
export interface CompletionRequest {
  instructions?: string
  messages: ChatMessage[]
}

/** Callbacks for the streamed response: `onToken` gets the clean answer, `onReasoning` the model's thinking. */
export interface CompletionHandlers {
  onToken?: (delta: string) => void
  onReasoning?: (delta: string) => void
}

export function isAiReady(settings: NessoSettings): boolean {
  return Boolean(settings.aiBaseUrl && settings.aiModel)
}

/**
 * Wraps the configured OpenAI-compatible endpoint with reasoning extraction so
 * inline `<think>…</think>` (Ollama qwen3, deepseek-r1, …) is split out of the
 * answer into a separate `reasoning-delta` stream instead of leaking into the reply.
 */
function mentorModel(settings: NessoSettings) {
  const provider = createOpenAICompatible({
    name: 'nesso-mentor',
    baseURL: settings.aiBaseUrl.replace(/\/+$/, ''),
    ...(settings.aiApiKey ? { apiKey: settings.aiApiKey } : {}),
  })
  return wrapLanguageModel({
    model: provider.chatModel(settings.aiModel),
    middleware: extractReasoningMiddleware({ tagName: 'think' }),
  })
}

/** True when the failure is a connection/CORS error rather than an HTTP response error. */
export function isNetworkFailure(err: unknown): boolean {
  if (APICallError.isInstance(err)) return err.statusCode === undefined
  return err instanceof TypeError
}

/**
 * Human-readable technical detail for a failed completion, shown verbatim to the
 * (technical) user as `<type>: <message>`. For an API error the SDK already parses
 * the endpoint's JSON error body into `message` (e.g. `model 'x' not found`), so this
 * uses that directly rather than the raw response body.
 */
export function describeCompletionError(err: unknown): string {
  if (APICallError.isInstance(err)) {
    const type = err.statusCode ? `HTTP ${err.statusCode}` : err.name
    return `${type}: ${err.message}`
  }
  if (err instanceof Error) return `${err.name}: ${err.message}`
  return String(err)
}

export async function fetchCompletion(
  settings: NessoSettings,
  request: CompletionRequest,
  maxTokens: number,
  signal?: AbortSignal,
  handlers?: CompletionHandlers,
): Promise<string> {
  // The SDK takes the system prompt as `instructions`, not a `system` role in `messages`.
  const result = streamText({
    model: mentorModel(settings),
    ...(request.instructions ? { instructions: request.instructions } : {}),
    messages: request.messages,
    maxOutputTokens: maxTokens,
    abortSignal: signal,
  })
  let text = ''
  for await (const part of result.stream) {
    if (part.type === 'text-delta') {
      text += part.text
      handlers?.onToken?.(part.text)
    } else if (part.type === 'reasoning-delta') {
      handlers?.onReasoning?.(part.text)
    } else if (part.type === 'error') {
      throw part.error
    }
  }
  return text
}
