// SPDX-License-Identifier: MIT
import { getEngine, LOCAL_MODEL_ID } from './webllm'
import type { NessoSettings } from '@/types/graph'

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

export function isAiReady(settings: NessoSettings): boolean {
  if (settings.aiMode === 'local') return getEngine() !== null
  return Boolean(settings.aiBaseUrl && settings.aiModel)
}

// The WebLLM engine cannot run two generations at once (the review mode and
// the mentor may request completions concurrently) — chain local calls.
let localGenChain: Promise<unknown> = Promise.resolve()

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
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
    const run = localGenChain.then(async () => {
      if (signal?.aborted) throw abortError()
      const onAbort = () => void engine.interruptGenerate()
      signal?.addEventListener('abort', onAbort)
      try {
        const reply = await engine.chat.completions.create({
          model: LOCAL_MODEL_ID,
          max_tokens: maxTokens,
          messages,
        })
        // interruptGenerate resolves the call with partial output — surface
        // the abort to the caller instead of a truncated reply.
        if (signal?.aborted) throw abortError()
        return reply.choices[0]?.message?.content ?? ''
      } finally {
        signal?.removeEventListener('abort', onAbort)
      }
    })
    localGenChain = run.catch(() => {})
    return run
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
