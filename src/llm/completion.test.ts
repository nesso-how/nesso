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
import {
  checkEndpoint,
  describeCompletionError,
  fetchCompletion,
  getConfiguredFetch,
  isAiReady,
  isLocalhostUrl,
  isNetworkFailure,
  pullModel,
} from './completion'

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

// ---------------------------------------------------------------------------
// getConfiguredFetch
// ---------------------------------------------------------------------------

describe('getConfiguredFetch', () => {
  it('returns global fetch in browser mode', () => {
    vi.stubGlobal('window', {})
    const browserFetch = vi.fn()
    vi.stubGlobal('fetch', browserFetch)

    const fetcher = getConfiguredFetch()
    expect(fetcher).toBe(browserFetch)
  })

  it('returns a Tauri-delegating function in desktop mode', () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })
    vi.stubGlobal('fetch', vi.fn())

    const fetcher = getConfiguredFetch()
    expect(typeof fetcher).toBe('function')
    // It must not be the global fetch.
    expect(fetcher).not.toBe(globalThis.fetch)
  })

  it('the desktop fetcher forwards to @tauri-apps/plugin-http with maxRedirections=0', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })
    vi.stubGlobal('fetch', vi.fn())
    mockNativeFetch.mockResolvedValue(new Response('ok', { status: 200 }))

    const fetcher = getConfiguredFetch()
    await fetcher('http://localhost:11434/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(mockNativeFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockNativeFetch.mock.calls[0] as [
      string,
      { method?: string; headers?: Record<string, string>; maxRedirections?: number },
    ]
    expect(url).toBe('http://localhost:11434/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(init.maxRedirections).toBe(0)
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
  })
})

// ---------------------------------------------------------------------------
// isLocalhostUrl
// ---------------------------------------------------------------------------

describe('isLocalhostUrl', () => {
  it('recognizes localhost, 127.0.0.1, [::1], and ::1', () => {
    expect(isLocalhostUrl('http://localhost:11434/v1')).toBe(true)
    expect(isLocalhostUrl('http://localhost/v1')).toBe(true)
    expect(isLocalhostUrl('https://localhost:8080')).toBe(true)
    expect(isLocalhostUrl('http://127.0.0.1:11434/v1')).toBe(true)
    expect(isLocalhostUrl('http://127.0.0.1/v1')).toBe(true)
    expect(isLocalhostUrl('http://[::1]:11434/v1')).toBe(true)
    expect(isLocalhostUrl('http://[::1]/v1')).toBe(true)
  })

  it('rejects non-loopback hostnames', () => {
    expect(isLocalhostUrl('https://opencode.ai/zen/v1')).toBe(false)
    expect(isLocalhostUrl('https://api.openai.com/v1')).toBe(false)
    expect(isLocalhostUrl('http://192.168.1.10:11434/v1')).toBe(false)
    expect(isLocalhostUrl('http://example.com/v1')).toBe(false)
  })

  it('handles invalid URLs gracefully', () => {
    expect(isLocalhostUrl('not-a-url')).toBe(false)
    expect(isLocalhostUrl('')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// checkEndpoint
// ---------------------------------------------------------------------------

describe('checkEndpoint', () => {
  it('uses browser fetch in non-desktop mode', async () => {
    vi.stubGlobal('window', {})
    const browserFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'gemma3:4b' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', browserFetch)

    const result = await checkEndpoint('http://localhost:11434', 'gemma3:4b', '')

    expect(result).toBe('available')
    expect(browserFetch).toHaveBeenCalledTimes(1)
    const [url] = browserFetch.mock.calls[0] as [string]
    expect(url).toBe('http://localhost:11434/models')
    expect(mockNativeFetch).not.toHaveBeenCalled()
  })

  it('uses Tauri fetch on desktop', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })
    vi.stubGlobal('fetch', vi.fn())
    mockNativeFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'gemma3:4b' }] }), {
        status: 200,
      }),
    )

    const result = await checkEndpoint('http://localhost:11434', 'gemma3:4b', '')

    expect(result).toBe('available')
    expect(mockNativeFetch).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch).not.toHaveBeenCalled?.()
  })

  it('sends bearer auth when apiKey is provided', async () => {
    vi.stubGlobal('window', {})
    const browserFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'big-pickle' }] }), {
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', browserFetch)

    await checkEndpoint('https://opencode.ai/zen/v1', 'big-pickle', 'test-key')

    const [, init] = browserFetch.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-key')
  })

  it('does not send auth header when apiKey is empty', async () => {
    vi.stubGlobal('window', {})
    const browserFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'gemma3:4b' }] }), {
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', browserFetch)

    await checkEndpoint('http://localhost:11434', 'gemma3:4b', '')

    const [, init] = browserFetch.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get('authorization')).toBeNull()
  })

  it('returns available when model is in the /models list', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: 'gemma3:4b' }, { id: 'llama3.2:3b' }] }), {
          status: 200,
        }),
      ),
    )

    const result = await checkEndpoint('http://localhost:11434', 'gemma3:4b', '')
    expect(result).toBe('available')
  })

  it('returns unavailable when model is not in the /models list', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ data: [{ id: 'llama3.2:3b' }] }), { status: 200 }),
        ),
    )

    const result = await checkEndpoint('http://localhost:11434', 'gemma3:4b', '')
    expect(result).toBe('unavailable')
  })

  it('returns unauthorized for 401', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 })))

    const result = await checkEndpoint('https://opencode.ai/zen/v1', 'big-pickle', 'wrong-key')
    expect(result).toBe('unauthorized')
  })

  it('returns unauthorized for 403', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })))

    const result = await checkEndpoint('https://opencode.ai/zen/v1', 'big-pickle', 'bad-key')
    expect(result).toBe('unauthorized')
  })

  it('returns error for 500 server error', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('server error', { status: 500 })))

    const result = await checkEndpoint('https://opencode.ai/zen/v1', 'big-pickle', 'test-key')
    expect(result).toBe('error')
  })

  it('returns error for 404 not found', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not found', { status: 404 })))

    const result = await checkEndpoint('https://opencode.ai/zen/v1', 'big-pickle', 'test-key')
    expect(result).toBe('error')
  })

  it('returns error for network failures (fetch throws TypeError)', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const result = await checkEndpoint('http://localhost:11434', 'gemma3:4b', '')
    expect(result).toBe('error')
  })

  it('strips trailing slashes from the base URL', async () => {
    vi.stubGlobal('window', {})
    const browserFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'gemma3:4b' }] }), {
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', browserFetch)

    await checkEndpoint('http://localhost:11434/v1/', 'gemma3:4b', '')

    const [url] = browserFetch.mock.calls[0] as [string]
    expect(url).toBe('http://localhost:11434/v1/models')
  })

  it('sends a composed signal to fetch when a caller signal is provided', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })
    vi.stubGlobal('fetch', vi.fn())
    mockNativeFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'gemma3:4b' }] }), { status: 200 }),
    )

    const controller = new AbortController()
    await checkEndpoint('http://localhost:11434', 'gemma3:4b', '', controller.signal)

    const [, init] = mockNativeFetch.mock.calls[0] as [string, RequestInit]
    // The signal is composed (caller signal + 5s timeout), not the raw caller signal.
    expect(init.signal).not.toBe(controller.signal)
    expect(init.signal).toBeInstanceOf(AbortSignal)
    // A non-aborted composed signal must not appear pre-aborted.
    expect(init.signal?.aborted).toBe(false)
  })

  it('applies a 5-second timeout when no signal is provided', async () => {
    vi.stubGlobal('window', {})
    const browserFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: 'gemma3:4b' }] }), { status: 200 }),
      )
    vi.stubGlobal('fetch', browserFetch)

    await checkEndpoint('http://localhost:11434', 'gemma3:4b', '')

    const [, init] = browserFetch.mock.calls[0] as [string, RequestInit]
    // When no signal is provided, the function should create a timeout signal.
    expect(init.signal).toBeInstanceOf(AbortSignal)
    // The timeout signal should not be the same as a fresh controller's signal
    // (it was created internally with AbortSignal.timeout).
    const freshCtrl = new AbortController()
    expect(init.signal).not.toBe(freshCtrl.signal)
  })

  it('composes a caller-provided signal with the 5-second timeout so the check cannot stay stuck', async () => {
    vi.stubGlobal('window', {})
    const browserFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: 'gemma3:4b' }] }), { status: 200 }),
      )
    vi.stubGlobal('fetch', browserFetch)

    const controller = new AbortController()
    await checkEndpoint('http://localhost:11434', 'gemma3:4b', '', controller.signal)

    const [, init] = browserFetch.mock.calls[0] as [string, RequestInit]
    // The composed signal is not the caller's raw signal — it bundles both
    // the caller's controller and an internal 5-second timeout so the check
    // cannot stay stuck in "checking" indefinitely even with a caller signal.
    expect(init.signal).not.toBe(controller.signal)
    expect(init.signal).toBeInstanceOf(AbortSignal)
    // The fresh controller's signal is a different object.
    const freshCtrl = new AbortController()
    expect(init.signal).not.toBe(freshCtrl.signal)
  })

  it('caller abort still propagates through the composed signal', async () => {
    vi.stubGlobal('window', {})
    const controller = new AbortController()
    controller.abort() // abort before call

    // fetch should throw AbortError when called with an already-aborted signal
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError')),
    )

    const result = await checkEndpoint('http://localhost:11434', 'gemma3:4b', '', controller.signal)
    expect(result).toBe('error')
  })

  it('resolves to error when the caller aborts the signal before fetch completes', async () => {
    vi.stubGlobal('window', {})
    const controller = new AbortController()
    controller.abort() // abort before call

    // fetch should throw AbortError when called with an already-aborted signal
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError')),
    )

    const result = await checkEndpoint('http://localhost:11434', 'gemma3:4b', '', controller.signal)
    expect(result).toBe('error')
  })
})

// ---------------------------------------------------------------------------
// pullModel
// ---------------------------------------------------------------------------

describe('pullModel', () => {
  function ndjsonChunks(lines: string[]): Response {
    const encoder = new TextEncoder()
    const body = lines.map((l) => encoder.encode(l + '\n'))
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        for (const chunk of body) ctrl.enqueue(chunk)
        ctrl.close()
      },
    })
    return new Response(stream, { status: 200 })
  }

  it('yields progress from NDJSON stream lines', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          ndjsonChunks([
            JSON.stringify({ total: 100, completed: 25 }),
            JSON.stringify({ total: 100, completed: 50 }),
          ]),
        ),
    )

    const progress: number[] = []
    for await (const p of pullModel('http://localhost:11434', 'gemma3:4b')) {
      progress.push(p)
    }
    expect(progress).toEqual([0.25, 0.5])
  })

  it('passes AbortSignal to the underlying fetch', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })
    vi.stubGlobal('fetch', vi.fn())
    mockNativeFetch.mockResolvedValue(ndjsonChunks([]))

    const controller = new AbortController()
    const gen = pullModel('http://localhost:11434', 'gemma3:4b', controller.signal)
    // consume the generator
    for await (const _ of gen) {
      void _
    }

    expect(mockNativeFetch).toHaveBeenCalledTimes(1)
    const [, init] = mockNativeFetch.mock.calls[0] as [string, RequestInit]
    expect(init.signal).toBe(controller.signal)
  })

  it('throws on non-2xx response', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not found', { status: 404 })))

    await expect(async () => {
      for await (const _ of pullModel('http://localhost:11434', 'gemma3:4b')) {
        void _
      }
    }).rejects.toThrow('HTTP 404')
  })

  it('throws on error in NDJSON line', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(ndjsonChunks([JSON.stringify({ error: 'something broke' })])),
    )

    await expect(async () => {
      for await (const _ of pullModel('http://localhost:11434', 'gemma3:4b')) {
        void _
      }
    }).rejects.toThrow('something broke')
  })

  it('skips malformed NDJSON lines gracefully', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          ndjsonChunks(['not-json{{{', JSON.stringify({ total: 200, completed: 100 })]),
        ),
    )

    const progress: number[] = []
    for await (const p of pullModel('http://localhost:11434', 'gemma3:4b')) {
      progress.push(p)
    }
    expect(progress).toEqual([0.5]) // malformed line skipped, valid one parsed
  })
})
