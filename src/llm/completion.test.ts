// SPDX-License-Identifier: MIT
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NessoSettings } from '@/types/graph'
import { fetchCompletion, isAiReady } from './completion'

const settings = {
  aiBaseUrl: 'http://localhost:11434/v1',
  aiModel: 'gemma3:4b',
  aiApiKey: '',
} as unknown as NessoSettings

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

function sentBody(mock: ReturnType<typeof vi.fn>): { stream?: boolean } {
  const init = mock.mock.calls[0]?.[1] as RequestInit | undefined
  return JSON.parse((init?.body as string | undefined) ?? '{}')
}

afterEach(() => vi.restoreAllMocks())

describe('isAiReady', () => {
  it('requires both a base URL and a model', () => {
    expect(isAiReady(settings)).toBe(true)
    expect(isAiReady({ ...settings, aiModel: '' } as NessoSettings)).toBe(false)
    expect(isAiReady({ ...settings, aiBaseUrl: '' } as NessoSettings)).toBe(false)
  })
})

describe('fetchCompletion streaming (onToken)', () => {
  it('forwards each SSE delta and returns the concatenation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
          'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
          'data: [DONE]\n',
        ]),
      )
    vi.stubGlobal('fetch', fetchMock)

    const tokens: string[] = []
    const full = await fetchCompletion(
      settings,
      [{ role: 'user', content: 'hi' }],
      100,
      undefined,
      (delta) => tokens.push(delta),
    )

    expect(tokens).toEqual(['Hel', 'lo'])
    expect(full).toBe('Hello')
    expect(sentBody(fetchMock).stream).toBe(true)
  })

  it('reassembles a data line split across chunks', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse(['data: {"choices":[{"delta":{"con', 'tent":"X"}}]}\n', 'data: [DONE]\n']),
      )
    vi.stubGlobal('fetch', fetchMock)

    const tokens: string[] = []
    const full = await fetchCompletion(
      settings,
      [{ role: 'user', content: 'hi' }],
      100,
      undefined,
      (delta) => tokens.push(delta),
    )

    expect(full).toBe('X')
    expect(tokens).toEqual(['X'])
  })
})

describe('fetchCompletion non-streaming (no onToken)', () => {
  it('returns the message content and omits the stream flag', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'done' } }] }), {
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const full = await fetchCompletion(settings, [{ role: 'user', content: 'hi' }], 100)

    expect(full).toBe('done')
    expect(sentBody(fetchMock).stream).toBeUndefined()
  })

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })))
    await expect(fetchCompletion(settings, [], 100)).rejects.toThrow('boom')
  })
})
