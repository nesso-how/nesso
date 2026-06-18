// SPDX-License-Identifier: MIT
import type { NessoSettings } from '@/types/graph'

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

export function isAiReady(settings: NessoSettings): boolean {
  return Boolean(settings.aiBaseUrl && settings.aiModel)
}

/** Extracts the assistant text delta from one SSE line, or null for keepalive / `[DONE]` / unparseable lines. */
function sseLineDelta(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return null
  const payload = trimmed.slice(5).trim()
  if (payload === '[DONE]') return null
  try {
    const json = JSON.parse(payload) as { choices?: { delta?: { content?: string | null } }[] }
    return json.choices?.[0]?.delta?.content ?? null
  } catch {
    return null
  }
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onToken: (delta: string) => void,
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const delta = sseLineDelta(line)
        if (delta) {
          full += delta
          onToken(delta)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  return full
}

export async function fetchCompletion(
  settings: NessoSettings,
  messages: Message[],
  maxTokens: number,
  signal?: AbortSignal,
  onToken?: (delta: string) => void,
): Promise<string> {
  const baseUrl = settings.aiBaseUrl.replace(/\/+$/, '')
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(settings.aiApiKey ? { Authorization: `Bearer ${settings.aiApiKey}` } : {}),
    },
    body: JSON.stringify({
      model: settings.aiModel,
      max_tokens: maxTokens,
      messages,
      ...(onToken ? { stream: true } : {}),
    }),
  })
  if (!res.ok) throw new Error(await res.text())
  if (onToken && res.body) return readSseStream(res.body, onToken)
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}
