// SPDX-License-Identifier: MIT
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { APICallError, extractReasoningMiddleware, streamText, wrapLanguageModel } from 'ai'
import { isDesktop } from '@/lib/isDesktop'
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

// ---------------------------------------------------------------------------
// Platform adapter — single boundary for all AI HTTP I/O
// ---------------------------------------------------------------------------

const _desktopFetch: typeof globalThis.fetch = async (input, init) => {
  const { fetch } = await import('@tauri-apps/plugin-http')
  return fetch(input, { ...init, maxRedirections: 0 })
}

/**
 * Returns the platform-appropriate fetch implementation:
 * Tauri's native HTTP client on desktop (with maxRedirections: 0),
 * or the browser's global fetch otherwise.
 */
export function getConfiguredFetch(): typeof globalThis.fetch {
  return isDesktop() ? _desktopFetch : globalThis.fetch
}

/**
 * Returns true when the URL's hostname is a loopback address:
 * `localhost`, `127.0.0.1`, `::1`, or `[::1]`.
 * Invalid URLs return false.
 */
export function isLocalhostUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]'
    )
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Endpoint health check (OpenAI-compatible /models)
// ---------------------------------------------------------------------------

/**
 * Checks whether a model is available at the given base URL by querying the
 * `/models` endpoint. Returns one of:
 * - `'available'`   — model found in the list
 * - `'unavailable'` — endpoint reachable, list returned, but model not present
 * - `'unauthorized'` — HTTP 401 or 403
 * - `'error'`       — network failure, timeout, or any other non-2xx response
 *
 * When the caller provides a signal it is passed straight through to fetch.
 * When no signal is given a 5-second timeout is applied internally.
 */
export async function checkEndpoint(
  baseUrl: string,
  model: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<'available' | 'unavailable' | 'unauthorized' | 'error'> {
  try {
    const cleanUrl = baseUrl.replace(/\/+$/, '')
    const fetcher = getConfiguredFetch()
    const headers: Record<string, string> = {}
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }
    const effectiveSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(5000)])
      : AbortSignal.timeout(5000)
    const res = await fetcher(`${cleanUrl}/models`, {
      signal: effectiveSignal,
      headers,
    })
    if (res.status === 401 || res.status === 403) return 'unauthorized'
    if (!res.ok) return 'error'
    const data = (await res.json()) as { data?: { id: string }[] }
    const ids = (data.data ?? []).map((m) => m.id)
    return ids.includes(model) ? 'available' : 'unavailable'
  } catch {
    return 'error'
  }
}

// ---------------------------------------------------------------------------
// Native Ollama model pull (streaming NDJSON progress)
// ---------------------------------------------------------------------------

/**
 * Strips trailing slashes and an optional `/v1` suffix from an OpenAI-compatible
 * base URL, yielding the native Ollama base URL (e.g. for `/api/pull`).
 */
export function ollamaNativeBase(aiBaseUrl: string): string {
  return aiBaseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
}

/**
 * Async-generator that yields individual lines as they arrive from a
 * ReadableStream of Uint8Array chunks. Handles buffering of partial lines
 * across chunk boundaries.
 */
async function* _readChunkLines(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    yield* lines
  }
}

/**
 * Parses one NDJSON line from an Ollama pull stream. Returns a progress
 * fraction (0–1), or null if the line should be skipped (blank, malformed,
 * or missing progress fields). Throws on `{"error": "…"}` entries.
 */
function _parsePullLine(line: string): number | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  let obj: { error?: string; total?: number; completed?: number }
  try {
    obj = JSON.parse(trimmed) as typeof obj
  } catch {
    return null // malformed/truncated NDJSON line — don't kill the pull
  }
  if (obj.error) throw new Error(obj.error)
  if (obj.total && obj.completed != null) return obj.completed / obj.total
  return null
}

/**
 * Streams a native Ollama model pull via `/api/pull`, yielding progress
 * fractions (0–1). Throws on non-2xx responses or error entries in the
 * NDJSON stream. The consumer should use the AbortSignal to cancel the
 * pull (e.g. when the settings dialog closes).
 */
export async function* pullModel(
  baseUrl: string,
  model: string,
  signal?: AbortSignal,
): AsyncGenerator<number> {
  const fetcher = getConfiguredFetch()
  const nativeBase = ollamaNativeBase(baseUrl)
  const res = await fetcher(`${nativeBase}/api/pull`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: model }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const reader = res.body!.getReader()
  try {
    for await (const line of _readChunkLines(reader)) {
      const progress = _parsePullLine(line)
      if (progress !== null) yield progress
    }
  } finally {
    // Release the connection when the consumer stops early (dialog closed).
    await reader.cancel().catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Pull orchestrator — drives progress callback, handles abort/error
// ---------------------------------------------------------------------------

/**
 * Pulls a model via pullModel, calling onProgress with each fraction (0–1).
 * Returns true when the pull completes successfully, false when the signal
 * was aborted or an error occurred. The caller uses the returned boolean to
 * decide the final UI status.
 */
export async function executeModelPull(
  baseUrl: string,
  model: string,
  signal: AbortSignal,
  onProgress: (fraction: number) => void,
): Promise<boolean> {
  try {
    for await (const fraction of pullModel(baseUrl, model, signal)) {
      if (signal.aborted) return false
      onProgress(fraction)
    }
    return !signal.aborted
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Streaming completion (mentor chat) — existing
// ---------------------------------------------------------------------------

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
    ...(isDesktop() ? { fetch: _desktopFetch } : {}),
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
