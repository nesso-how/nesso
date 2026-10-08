import { randomUUID } from 'node:crypto'
import { aiProviders, type AiConnectionInput, type AiConnections, type AiProvider } from './ai-contract.ts'
import { ElectronError } from './errors.ts'

type Connection = Omit<AiConnectionInput, 'id' | 'apiKey'> & { id: string; apiKey: string }
type Record = { connections: Connection[]; activeId: string | null }
type Storage = { read: () => string | null; write: (value: string) => void }

const fail = (path: string, message: string): never => { throw new ElectronError([{ path, message }]) }
const object = (value: unknown): { [key: string]: unknown } => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('connection', 'Expected an object')
  return value as { [key: string]: unknown }
}
const text = (value: unknown, path: string, max = 256): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) return fail(path, `Expected non-empty text (maximum ${max} characters)`)
  return value.trim()
}

const parseEndpoint = (value: unknown): string => {
  const endpoint = text(value, 'endpoint', 2048)
  let url: URL
  try { url = new URL(endpoint) } catch { return fail('endpoint', 'Invalid URL') }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (!(url.protocol === 'https:' || url.protocol === 'http:' && loopback) || url.username || url.password || url.search || url.hash) {
    return fail('endpoint', 'Use HTTPS, or HTTP on localhost, without credentials, query or fragment')
  }
  return endpoint.replace(/\/+$/, '')
}

const parse = (value: unknown, previous?: Connection, requireModel = true): Connection => {
  const input = object(value)
  const provider = text(input.provider, 'provider')
  if (!Object.hasOwn(aiProviders, provider)) return fail('provider', 'Unknown provider')
  const endpoint = parseEndpoint(input.endpoint)
  if (input.apiKey !== undefined && (typeof input.apiKey !== 'string' || input.apiKey.length > 8192)) return fail('apiKey', 'Invalid API key')
  const sameDestination = previous?.provider === provider && previous.endpoint === endpoint
  const apiKey = typeof input.apiKey === 'string' && input.apiKey.trim() ? input.apiKey.trim() : sameDestination ? previous.apiKey : ''
  if (!apiKey && provider !== 'custom') return fail('apiKey', 'API key required')
  return {
    id: input.id === undefined ? randomUUID() : text(input.id, 'id'),
    name: text(input.name, 'name', 80), provider: provider as AiProvider,
    endpoint, model: requireModel ? text(input.model, 'model') : '', apiKey,
  }
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
  try { return object(await response.json()) } catch { return fail('endpoint', 'Invalid model list') }
}

const nextModelPage = (body: { [key: string]: unknown }, provider: AiProvider): string => {
  if (provider === 'gemini' && body.nextPageToken) return `?${new URLSearchParams({ pageToken: text(body.nextPageToken, 'models.cursor', 2048) })}`
  if (provider === 'anthropic' && body.has_more) return `?${new URLSearchParams({ after_id: text(body.last_id, 'models.cursor', 2048) })}`
  return ''
}

const fetchModels = async (entry: Connection, request: typeof fetch): Promise<readonly string[]> => {
  const ids = new Set<string>()
  const cursors = new Set<string>()
  const gemini = entry.provider === 'gemini'
  let query = ''
  do {
    const body = await fetchModelPage(entry, query, request)
    const models = gemini ? body.models : body.data
    if (!Array.isArray(models)) return fail('endpoint', 'Invalid model list')
    for (const item of models) {
      const model = object(item)
      const id = text(gemini ? model.name : model.id, 'model')
      ids.add(gemini ? id.replace(/^models\//, '') : id)
    }
    query = nextModelPage(body, entry.provider)
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
      const record = object(JSON.parse(raw))
      if (!Array.isArray(record.connections)) return fail('storage', 'Invalid connections')
      const connections = record.connections.map((item: unknown) => {
        if (typeof object(item).id !== 'string') return fail('storage', 'Missing connection ID')
        return parse(item)
      })
      if (new Set(connections.map(({ id }) => id)).size !== connections.length) return fail('storage', 'Duplicate connection ID')
      if (record.activeId !== null && !connections.some(({ id }) => id === record.activeId)) return fail('storage', 'Invalid active connection')
      return { connections, activeId: record.activeId as string | null }
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
  const connection = (record: Record, id: unknown) => record.connections.find((entry) => entry.id === text(id, 'id'))
    ?? fail('id', 'Unknown connection')
  const prepare = (record: Record, value: unknown, requireModel = true) => {
    const input = object(value)
    return parse(value, input.id === undefined ? undefined : connection(record, input.id), requireModel)
  }
  return {
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
