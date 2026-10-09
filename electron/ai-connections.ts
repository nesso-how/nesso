import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { aiConnectionInput, type AiConnections } from '@nesso/ai/providers'
import { ElectronError } from './errors.ts'

const connectionInput = aiConnectionInput.extend({
  endpoint: aiConnectionInput.shape.endpoint.transform((value, context) => {
    const url = new URL(value)
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (!(url.protocol === 'https:' || url.protocol === 'http:' && loopback) || url.username || url.password || url.search || url.hash) {
      context.addIssue({ code: 'custom', message: 'Use HTTPS, or HTTP on localhost, without credentials, query or fragment' })
    }
    return value.replace(/\/+$/, '')
  }),
})
const storedConnection = connectionInput.extend({
  id: aiConnectionInput.shape.id.unwrap(),
  apiKey: aiConnectionInput.shape.apiKey.unwrap(),
}).refine((entry) => entry.provider === 'custom' || !!entry.apiKey, { path: ['apiKey'], message: 'API key required' })
const storedRecord = z.object({ connections: z.array(storedConnection), activeId: z.string().nullable() })
  .refine(({ connections }) => new Set(connections.map(({ id }) => id)).size === connections.length,
    { path: ['connections'], message: 'Duplicate connection ID' })
  .refine(({ connections, activeId }) => activeId === null || connections.some(({ id }) => id === activeId),
    { path: ['activeId'], message: 'Invalid active connection' })
const discoveryInput = connectionInput.extend({ model: z.unknown().transform(() => '') })
const cursor = z.string().max(2048).trim().min(1)
const modelPage = z.object({
  data: z.array(z.object({ id: aiConnectionInput.shape.model })),
  has_more: z.boolean().optional(),
  last_id: cursor.optional(),
})
const geminiModelPage = z.object({
  models: z.array(z.object({ name: aiConnectionInput.shape.model })),
  nextPageToken: cursor.optional(),
})
type Connection = z.infer<typeof storedConnection>
type Record = z.infer<typeof storedRecord>
type Storage = { read: () => string | null; write: (value: string) => void }

const fail = (path: string, message: string): never => { throw new ElectronError([{ path, message }]) }
const parse = <T>(schema: z.ZodType<T>, value: unknown, location = 'connection'): T => {
  const result = schema.safeParse(value)
  if (!result.success) throw new ElectronError(result.error.issues.map(({ path, message }) => ({ path: path.join('.') || location, message })))
  return result.data
}

const modelHeaders = (entry: Connection): { [key: string]: string } => {
  if (!entry.apiKey) return {}
  switch (entry.provider) {
    case 'anthropic': return { 'x-api-key': entry.apiKey, 'anthropic-version': '2023-06-01' }
    case 'gemini': return { 'x-goog-api-key': entry.apiKey }
    default: return { Authorization: `Bearer ${entry.apiKey}` }
  }
}

const fetchModelPage = async (entry: Connection, query: string, request: typeof fetch) => {
  let response: Response
  try {
    response = await request(`${entry.endpoint}/models${query}`, { headers: modelHeaders(entry), redirect: 'error', signal: AbortSignal.timeout(15_000) })
  } catch { return fail('endpoint', 'Connection failed or timed out') }
  if (!response.ok) return fail('endpoint', `Provider returned HTTP ${response.status}`)
  try { return await response.json() as unknown } catch { return fail('endpoint', 'Invalid model list') }
}

const fetchModels = async (entry: Connection, request: typeof fetch): Promise<readonly string[]> => {
  const ids = new Set<string>()
  const cursors = new Set<string>()
  const gemini = entry.provider === 'gemini'
  let query = ''
  do {
    const raw = await fetchModelPage(entry, query, request)
    const page = (gemini ? geminiModelPage : modelPage).safeParse(raw)
    if (!page.success) return fail('endpoint', 'Invalid model list')
    const body = page.data
    if ('models' in body) {
      for (const model of body.models) ids.add(model.name.replace(/^models\//, ''))
      query = body.nextPageToken ? `?${new URLSearchParams({ pageToken: body.nextPageToken })}` : ''
    } else {
      for (const model of body.data) ids.add(model.id)
      query = entry.provider === 'anthropic' && body.has_more
        ? `?${new URLSearchParams({ after_id: parse(cursor, body.last_id, 'models.cursor') })}` : ''
    }
    if (query) {
      if (cursors.has(query) || cursors.size >= 20) return fail('endpoint', 'Invalid model pagination')
      cursors.add(query)
    }
  } while (query)
  return [...ids].sort()
}

export function createAiConnections(storage: Storage, request: typeof fetch = fetch) {
  const load = (): Record => {
    let raw: string | null
    try { raw = storage.read() } catch { return fail('storage', 'Cannot decrypt AI connections; existing data has not been changed') }
    if (raw === null) return { connections: [], activeId: null }
    try {
      return parse(storedRecord, JSON.parse(raw))
    } catch { return fail('storage', 'Unreadable AI connections; existing data has not been changed') }
  }
  const snapshot = (record: Record): AiConnections => ({
    activeId: record.activeId,
    connections: record.connections.map(({ apiKey, ...connection }) => ({ ...connection, hasKey: !!apiKey })),
  })
  const saveRecord = (record: Record) => {
    try { storage.write(JSON.stringify(record)) } catch { return fail('storage', 'Cannot securely save AI connections') }
    return snapshot(record)
  }
  const connection = (record: Record, value: unknown) => {
    const id = parse(aiConnectionInput.shape.id.unwrap(), value, 'id')
    return record.connections.find((entry) => entry.id === id) ?? fail('id', 'Unknown connection')
  }
  const prepare = (record: Record, value: unknown, requireModel = true): Connection => {
    const input = parse(requireModel ? connectionInput : discoveryInput, value)
    const previous = input.id === undefined ? undefined : connection(record, input.id)
    const sameDestination = previous?.provider === input.provider && previous.endpoint === input.endpoint
    const apiKey = input.apiKey || (sameDestination ? previous.apiKey : '')
    if (!apiKey && input.provider !== 'custom') return fail('apiKey', 'API key required')
    return { ...input, id: input.id ?? randomUUID(), apiKey }
  }
  return {
    active: () => {
      const record = load()
      return record.activeId === null ? fail('connection', 'Choose an active connection in Settings') : connection(record, record.activeId)
    },
    list: () => snapshot(load()),
    save: (input: unknown) => {
      const record = load()
      const next = prepare(record, input)
      const index = record.connections.findIndex(({ id }) => id === next.id)
      if (index < 0) record.connections.push(next)
      else record.connections[index] = next
      record.activeId ??= next.id
      return saveRecord(record)
    },
    remove: (id: unknown) => {
      const record = load()
      const target = connection(record, id)
      record.connections = record.connections.filter((entry) => entry.id !== target.id)
      if (record.activeId === target.id) record.activeId = record.connections[0]?.id ?? null
      return saveRecord(record)
    },
    activate: (id: unknown) => {
      const record = load()
      record.activeId = connection(record, id).id
      return saveRecord(record)
    },
    verify: async (input: unknown): Promise<true> => {
      const entry = prepare(load(), input)
      const models = await fetchModels(entry, request)
      const model = entry.provider === 'gemini' ? entry.model.replace(/^models\//, '') : entry.model
      if (!models.includes(model)) return fail('model', 'Model not found at this endpoint')
      return true
    },
    models: (input: unknown) => fetchModels(prepare(load(), input, false), request),
  }
}
