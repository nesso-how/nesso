// SPDX-License-Identifier: MIT
import { getEngine, LOCAL_MODEL_ID } from './webllm'
import type { NessoSettings } from '@/types/graph'

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

export function isAiReady(settings: NessoSettings): boolean {
  if (settings.aiMode === 'local') return getEngine() !== null
  return Boolean(settings.aiBaseUrl && settings.aiModel)
}

export async function fetchCompletion(
  settings: NessoSettings,
  messages: Message[],
  maxTokens: number,
  signal?: AbortSignal,
): Promise<string> {
  if (settings.aiMode === 'local') {
    const engine = getEngine()
    if (!engine) throw new Error('Local model not ready')
    const reply = await engine.chat.completions.create({
      model: LOCAL_MODEL_ID,
      max_tokens: maxTokens,
      messages,
    })
    return reply.choices[0]?.message?.content ?? ''
  }

  const baseUrl = settings.aiBaseUrl.replace(/\/+$/, '')
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(settings.aiApiKey ? { Authorization: `Bearer ${settings.aiApiKey}` } : {}),
    },
    body: JSON.stringify({ model: settings.aiModel, max_tokens: maxTokens, messages }),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}
