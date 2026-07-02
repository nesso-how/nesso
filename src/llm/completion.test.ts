// SPDX-License-Identifier: MIT
import { APICallError } from 'ai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NessoSettings } from '@/types/graph'
import { describeCompletionError, fetchCompletion, isAiReady, isNetworkFailure } from './completion'

const settings = {
  aiBaseUrl: 'http://localhost:11434/v1',
  aiModel: 'gemma3:4b',
  aiApiKey: '',
} as unknown as NessoSettings

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

afterEach(() => vi.restoreAllMocks())

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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(['Hel', 'lo'])))

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
})
