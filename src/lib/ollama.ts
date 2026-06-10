// SPDX-License-Identifier: MIT
export type OllamaModelStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'pulling'
  | 'error'

export function ollamaNativeBase(aiBaseUrl: string): string {
  return aiBaseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
}

export async function checkOllamaModel(
  baseUrl: string,
  model: string,
): Promise<'available' | 'unavailable' | 'error'> {
  try {
    const url = baseUrl.replace(/\/+$/, '')
    const res = await fetch(`${url}/models`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return 'error'
    const data = (await res.json()) as { data?: { id: string }[] }
    const ids = (data.data ?? []).map((m) => m.id)
    return ids.includes(model) ? 'available' : 'unavailable'
  } catch {
    return 'error'
  }
}

export async function* streamOllamaModelPull(
  baseUrl: string,
  model: string,
  signal?: AbortSignal,
): AsyncGenerator<number> {
  const res = await fetch(`${ollamaNativeBase(baseUrl)}/api/pull`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: model }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        let obj: { error?: string; total?: number; completed?: number }
        try {
          obj = JSON.parse(line) as typeof obj
        } catch {
          continue // malformed/truncated NDJSON line — don't kill the pull
        }
        if (obj.error) throw new Error(obj.error)
        if (obj.total && obj.completed != null) yield obj.completed / obj.total
      }
    }
  } finally {
    // Release the connection when the consumer stops early (dialog closed).
    await reader.cancel().catch(() => {})
  }
}
