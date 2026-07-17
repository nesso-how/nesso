// SPDX-License-Identifier: MIT
import { afterEach, describe, expect, it, vi } from 'vitest'

const { mockNativeFetch } = vi.hoisted(() => ({
  mockNativeFetch: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: mockNativeFetch,
}))

import { APICallError } from 'ai'
import type { NessoSettings } from '@/types/graph'
import { describeCompletionError, fetchCompletion, isAiReady, isNetworkFailure } from './completion'

const settings = {
  aiBaseUrl: 'http://localhost:11434/v1',
  aiModel: 'gemma3:4b',
  aiApiKey: '',
} as unknown as NessoSettings

const zenSettings = {
  ...settings,
  aiBaseUrl: 'https://opencode.ai/zen/v1',
  aiModel: 'big-pickle',
  aiApiKey: 'test-key',
} as NessoSettings

/** One OpenAI-compatible SSE chunk carrying a content delta. */
function chunk(content: string): string {
  return `data: ${JSON.stringify({
    id: '1',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta: { content } }],
  })}\n\n`
}

function sseResponse(contents: string[]): Response {
  const encoder = new TextEncoder()
  const stop = `data: ${JSON.stringify({
    id: '1',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
  })}\n\n`
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of contents) controller.enqueue(encoder.encode(chunk(c)))
      controller.enqueue(encoder.encode(stop))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

afterEach(() => {
  mockNativeFetch.mockReset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('isAiReady', () => {
  it('requires both a base URL and a model', () => {
    expect(isAiReady(settings)).toBe(true)
    expect(isAiReady({ ...settings, aiModel: '' } as NessoSettings)).toBe(false)
    expect(isAiReady({ ...settings, aiBaseUrl: '' } as NessoSettings)).toBe(false)
  })
})

describe('isNetworkFailure', () => {
  it('flags a connection error (APICallError without status) as network', () => {
    const err = new APICallError({
      message: 'fetch failed',
      url: 'http://x/v1/chat/completions',
      requestBodyValues: {},
      isRetryable: true,
    })
    expect(isNetworkFailure(err)).toBe(true)
  })

  it('flags an HTTP response error (APICallError with status) as non-network', () => {
    const err = new APICallError({
      message: 'server error',
      url: 'http://x/v1/chat/completions',
      requestBodyValues: {},
      statusCode: 500,
      isRetryable: false,
    })
    expect(isNetworkFailure(err)).toBe(false)
  })

  it('treats a bare TypeError as network and other errors as non-network', () => {
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkFailure(new Error('parse'))).toBe(false)
  })
})

describe('describeCompletionError', () => {
  it('prefers the SDK-parsed message over the raw JSON response body', () => {
    const err = new APICallError({
      message: "model 'x' not found",
      url: 'http://x/v1/chat/completions',
      requestBodyValues: {},
      statusCode: 404,
      responseBody: '{"error":{"message":"model \'x\' not found","type":"not_found_error"}}',
      isRetryable: false,
    })
    expect(describeCompletionError(err)).toBe("HTTP 404: model 'x' not found")
  })

  it('falls back to the error name when there is no HTTP status', () => {
    const err = new APICallError({
      message: 'fetch failed',
      url: 'http://x/v1/chat/completions',
      requestBodyValues: {},
      isRetryable: true,
    })
    expect(describeCompletionError(err)).toBe('AI_APICallError: fetch failed')
  })

  it('shows name and message for a plain error, and stringifies non-errors', () => {
    expect(describeCompletionError(new TypeError('boom'))).toBe('TypeError: boom')
    expect(describeCompletionError('boom')).toBe('boom')
  })
})

describe('fetchCompletion streaming', () => {
  it('forwards answer tokens and returns their concatenation, with a system prompt', async () => {
    vi.stubGlobal('window', {})
    const browserFetch = vi.fn().mockResolvedValue(sseResponse(['Hel', 'lo']))
    vi.stubGlobal('fetch', browserFetch)

    const tokens: string[] = []
    const full = await fetchCompletion(
      settings,
      { instructions: 'You are Socrates.', messages: [{ role: 'user', content: 'hi' }] },
      100,
      undefined,
      { onToken: (delta) => tokens.push(delta) },
    )

    expect(tokens.join('')).toBe('Hello')
    expect(full).toBe('Hello')
    expect(browserFetch).toHaveBeenCalledTimes(1)
    expect(mockNativeFetch).not.toHaveBeenCalled()
  })

  it('splits inline <think> reasoning out of the answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(sseResponse(['<think>', 'because', '</think>', 'Hello'])),
    )

    const answer: string[] = []
    const reasoning: string[] = []
    const full = await fetchCompletion(
      settings,
      { instructions: 'You are Socrates.', messages: [{ role: 'user', content: 'hi' }] },
      100,
      undefined,
      {
        onToken: (delta) => answer.push(delta),
        onReasoning: (delta) => reasoning.push(delta),
      },
    )

    expect(full.trim()).toBe('Hello')
    expect(answer.join('')).not.toContain('<think>')
    expect(reasoning.join('')).toContain('because')
  })

  it('uses Tauri fetch on desktop and preserves the request, bearer key, stream, and signal', async () => {
    const controller = new AbortController()
    const browserFetch = vi.fn()
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })
    vi.stubGlobal('fetch', browserFetch)
    mockNativeFetch.mockResolvedValue(sseResponse(['Hello']))

    const full = await fetchCompletion(
      zenSettings,
      {
        instructions: 'You are Socrates.',
        messages: [{ role: 'user', content: 'hi' }],
      },
      321,
      controller.signal,
    )

    expect(full).toBe('Hello')
    expect(browserFetch).not.toHaveBeenCalled()
    expect(mockNativeFetch).toHaveBeenCalledTimes(1)

    const [url, init] = mockNativeFetch.mock.calls[0] as [
      string,
      RequestInit & { maxRedirections?: number },
    ]
    expect(url).toBe('https://opencode.ai/zen/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(init.maxRedirections).toBe(0)
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-key')
    expect(init.signal).toBe(controller.signal)

    const body = JSON.parse(String(init.body)) as {
      model: string
      messages: { role: string; content: string }[]
      max_tokens: number
      stream: boolean
    }

    expect(body).toMatchObject({
      model: 'big-pickle',
      max_tokens: 321,
      stream: true,
      messages: [
        { role: 'system', content: 'You are Socrates.' },
        { role: 'user', content: 'hi' },
      ],
    })
    expect(url).not.toContain('test-key')
    expect(String(init.body)).not.toContain('test-key')
  })

  it('aborts a pending desktop stream, receives the signal, and delivers no late tokens', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })
    const browserFetch = vi.fn()
    vi.stubGlobal('fetch', browserFetch)

    const controller = new AbortController()
    const tokens: string[] = []

    let onFirstToken!: () => void
    const firstTokenDelivered = new Promise<void>((resolve) => {
      onFirstToken = resolve
    })

    // Gate that keeps the stream pending after the first chunk.
    // The test releases it after abort; the pull handler reads the
    // signal's aborted flag to decide whether to deliver late tokens.
    let releaseGate!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve
    })

    const encoder = new TextEncoder()
    const stopChunk = `data: ${JSON.stringify({
      id: '1',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    })}\n\n`

    mockNativeFetch.mockImplementation(async (_input, init) => {
      const sig = init?.signal as AbortSignal | undefined
      const stream = new ReadableStream<Uint8Array>({
        start(ctrl) {
          ctrl.enqueue(encoder.encode(chunk('Hel')))
        },
        async pull(ctrl) {
          await gate
          if (sig?.aborted) {
            ctrl.close()
            return
          }
          // Should only reach here if the signal was NOT properly
          // passed through or the abort did not propagate – the
          // late-token assertion below will catch it.
          ctrl.enqueue(encoder.encode(chunk('lo')))
          ctrl.enqueue(encoder.encode(stopChunk))
          ctrl.enqueue(encoder.encode('data: [DONE]\n\n'))
          ctrl.close()
        },
      })
      return new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })
    })

    const resultPromise = fetchCompletion(
      zenSettings,
      { instructions: 'You are Socrates.', messages: [{ role: 'user', content: 'hi' }] },
      100,
      controller.signal,
      {
        onToken: (delta) => {
          tokens.push(delta)
          onFirstToken()
        },
      },
    )

    await firstTokenDelivered
    expect(tokens).toEqual(['Hel'])

    controller.abort()

    // Unblock pull so it can observe the aborted signal and close.
    releaseGate()

    // Wait for the completion to settle (resolve or reject).
    await resultPromise.catch(() => {})

    // Signal must be the exact same object passed to the underlying fetch.
    expect(mockNativeFetch).toHaveBeenCalledTimes(1)
    const [, init] = mockNativeFetch.mock.calls[0] as [string, RequestInit]
    expect(init.signal).toBe(controller.signal)

    // No late tokens after abort — 'lo' was never emitted.
    expect(tokens).toEqual(['Hel'])

    // Browser fetch must not be called on desktop.
    expect(browserFetch).not.toHaveBeenCalled()
  })
})
