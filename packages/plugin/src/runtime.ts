import { z } from 'zod'
import type { DeepReadonly, GraphSnapshot, NessoOperation, Selection, SavedView, VocabDefinition } from './types.ts'
import type { Locale } from '@nesso-how/i18n'
import { parseOrThrow, PluginError } from './errors.ts'
import { parseDefinition, themeColors, type Definition } from './definitions.ts'
import { fileOpenOptions, fileOpenResult, fileSaveOptions, type FileOpenOptions, type FileOpenResult, type FileSaveOptions } from './files.ts'
import { createWriteCommands } from './commands.ts'
import { localizedText, text, type LocalizedText } from './i18n.ts'
export { resolvePluginText, type LocalizedText } from './i18n.ts'
export { parseOrThrow, PluginError } from './errors.ts'
export { parseDefinition, themeColors, type Definition } from './definitions.ts'
export { parseFileOptions, fileTextLimit, type FileOpenOptions, type FileSaveOptions, type FileOpenResult } from './files.ts'

export const runtimeLimits = { request: 32 * 1024 * 1024, snapshot: 64 * 1024 * 1024, pending: 64, deadline: 30_000, interaction: 300_000, initialization: 10_000, action: 120_000 } as const
export const themeTokens = [...themeColors, 'font-sans', 'font-mono', 'radius-control', 'radius-object', 'duration-state'] as const

const id = z.string().min(1).max(2048)
const position = z.strictObject({ x: z.number(), y: z.number() })
const selection = z.array(z.strictObject({ kind: z.enum(['concept', 'relation']), id }))
const relationType = z.strictObject({ id, label: z.string() })
const locale = z.enum(['en', 'it', 'zh-CN'])
const operation = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('concept.label'), id, value: z.string() }),
  z.strictObject({ kind: z.literal('concept.description'), id, value: z.string() }),
  z.strictObject({ kind: z.literal('concept.color'), id, value: z.string() }),
  z.strictObject({ kind: z.literal('concept.bold'), id, value: z.boolean() }),
  z.strictObject({ kind: z.literal('concept.italic'), id, value: z.boolean() }),
  z.strictObject({ kind: z.literal('concept.position'), id, value: position }),
  z.strictObject({ kind: z.literal('concept.positions'), updates: z.array(z.strictObject({ id, position })) }),
  z.strictObject({ kind: z.literal('concept.add'), id, position: position.optional() }),
  z.strictObject({ kind: z.literal('concept.remove'), id }),
  z.strictObject({ kind: z.literal('relation.connect'), source: id, target: id, type: relationType.optional() }),
  z.strictObject({ kind: z.literal('relation.reconnect'), id, source: id, target: id }),
  z.strictObject({ kind: z.literal('relation.type'), id, typeId: id }),
  z.strictObject({ kind: z.literal('relation.type.create'), id, typeId: id, label: z.string() }),
  z.strictObject({ kind: z.literal('relation.remove'), id }),
  z.strictObject({ kind: z.literal('document.reset'), id }),
  z.strictObject({ kind: z.literal('history.undo') }),
  z.strictObject({ kind: z.literal('history.redo') }),
  z.strictObject({ kind: z.literal('selection.set'), value: selection }),
  z.strictObject({ kind: z.literal('view.activate'), id: id.nullable() }),
  z.strictObject({ kind: z.literal('view.create'), id, name: z.string(), conceptIds: z.array(id) }),
  z.strictObject({ kind: z.literal('view.rename'), id, name: z.string() }),
  z.strictObject({ kind: z.literal('view.pin'), id, pinned: z.boolean() }),
  z.strictObject({ kind: z.literal('view.membership'), viewId: id, conceptId: id, included: z.boolean() }),
  z.strictObject({ kind: z.literal('view.remove'), id }),
  ...(['vocab', 'theme'] as const).map((kind) => z.strictObject({ kind: z.literal(`preferences.${kind}`), id })),
  z.strictObject({ kind: z.literal('preferences.locale'), value: locale }),
  z.strictObject({ kind: z.literal('preferences.panels'), value: z.strictObject({ explorerWidth: z.number(), inspectorWidth: z.number() }) }),
  z.strictObject({ kind: z.literal('preferences.section'), id: z.enum(['sidebar', 'sidebar.pinned-views', 'sidebar.views', 'inspector', 'inspector.connections', 'inspector.views', 'inspector.nodes']), open: z.boolean() }),
])

const options = z.strictObject({ historyGroup: id.optional(), atRevision: z.number().int().nonnegative().optional() })
const metadata = z.strictObject({ name: localizedText(128), description: localizedText(2048), documentation: localizedText(16_384) })
const pluginI18n = z.object({ metadata }).catchall(localizedText(16_384))
export type PluginI18n = DeepReadonly<{ metadata: z.infer<typeof metadata>; [key: string]: LocalizedText | z.infer<typeof metadata> }>

export function parsePluginI18n(value: unknown): PluginI18n {
  checkMessageSize(value, 64 * 1024)
  return parseOrThrow(pluginI18n, value, 'i18n.')
}

const manifestFields = {
  apiVersion: z.literal(1),
}
const jsEntry = z.string().max(240).regex(/^(?:[\w-]+\/)*[\w-]+\.js$/)
const jsonEntry = z.string().max(240).regex(/^(?:[\w-]+\/)*[\w-]+\.json$/)
const pluginWriteKinds = ['concept.label', 'concept.description', 'concept.color', 'concept.bold', 'concept.italic', 'concept.position', 'concept.positions', 'concept.add', 'concept.remove', 'relation.connect', 'relation.reconnect', 'relation.type', 'relation.type.create', 'relation.remove', 'selection.set', 'view.membership'] as const
const operationDeclarations = z.array(z.enum(pluginWriteKinds))
const manifest = z.discriminatedUnion('kind', [
  z.strictObject({ ...manifestFields, kind: z.literal('actions'), entry: jsEntry, writes: operationDeclarations, capabilities: z.array(z.enum(['files.open', 'files.save', 'notifications.notify'])) }),
  ...(['theme', 'vocab'] as const).map((kind) => z.strictObject({ ...manifestFields, kind: z.literal(kind), entry: jsonEntry, writes: z.tuple([]), capabilities: z.tuple([]) })),
]).refine((value) => new Set(value.writes).size === value.writes.length && new Set(value.capabilities).size === value.capabilities.length, 'Declarations must be unique')

export type PluginManifest = DeepReadonly<z.infer<typeof manifest>>

export function parsePluginManifest(value: unknown): z.infer<typeof manifest> {
  checkMessageSize(value, 64 * 1024)
  return parseOrThrow(manifest, value)
}
const envelope = { type: z.literal('request'), id: z.number().int().positive(), contextId: id }
const request = z.discriminatedUnion('method', [
  z.strictObject({ ...envelope, method: z.literal('store.applyOperations'), params: z.strictObject({ operations: z.array(operation).max(50_000), options: options.optional() }) }),
  z.strictObject({ ...envelope, method: z.literal('store.refresh'), params: z.strictObject({}) }),
  z.strictObject({ ...envelope, method: z.literal('notifications.notify'), params: z.strictObject({ tone: z.enum(['info', 'warning']), title: localizedText(256), description: localizedText(4096).optional() }) }),
  z.strictObject({ ...envelope, method: z.literal('files.open'), params: fileOpenOptions }),
  z.strictObject({ ...envelope, method: z.literal('files.save'), params: fileSaveOptions }),
])
const wireError = z.strictObject({ code: z.enum(['invalid-input', 'denied', 'stale-state', 'stale-context', 'unavailable', 'cancelled', 'timeout', 'closed', 'failed']), issues: z.array(z.strictObject({ path: text(256), message: text(2048) })).min(1).max(32), displayMessage: localizedText(2048).optional() })
const message = z.union([request, z.strictObject({ type: z.literal('contribution'), value: z.unknown() }), z.strictObject({ type: z.literal('close'), reason: z.string().max(2048) }), z.strictObject({ type: z.literal('complete'), ok: z.literal(true) }), z.strictObject({ type: z.literal('complete'), ok: z.literal(false), error: wireError })])
const actionDescriptor = z.strictObject({ id: z.string().max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), label: localizedText(128), icon: z.string().min(1).max(32).regex(/^[a-z]+(?:-[a-z]+)*$/).optional() })
export const actionIconNames = ['arrow-right', 'book-open', 'clipboard-paste', 'copy', 'download', 'file-down', 'file-up', 'folder', 'globe', 'layers', 'pencil', 'play', 'plus', 'refresh', 'scissors', 'search', 'share', 'sparkles', 'upload', 'zap'] as const
export type ActionIconName = typeof actionIconNames[number]
const actionDescriptors = z.array(actionDescriptor).min(1).max(64).refine((value) => new Set(value.map(({ id }) => id)).size === value.length, 'Action IDs must be unique')
export type ActionDescriptor = DeepReadonly<z.infer<typeof actionDescriptor>>
export type ActionContribution = ActionDescriptor & { readonly run: (invocation: { readonly viewId: string | null }) => void | Promise<void> }

export function parseContribution(kind: 'theme' | 'vocab', value: unknown): Definition
export function parseContribution(kind: 'actions', value: unknown): readonly ActionDescriptor[]
export function parseContribution(kind: 'theme' | 'vocab' | 'actions', value: unknown): Definition | readonly ActionDescriptor[] {
  checkMessageSize(value, 1024 * 1024)
  if (kind === 'theme' || kind === 'vocab') return parseDefinition(kind, value)
  return parseOrThrow(actionDescriptors, value)
}

export type BaseState = {
  readonly revision: number
  readonly contextId: string
  readonly locale: Locale
  readonly theme: Readonly<Record<string, string>>
  readonly conceptPlacementOffset: Readonly<{ x: number; y: number }>
}

export type ViewState = BaseState & {
  readonly viewGraph: GraphSnapshot
  readonly selected: Selection
  readonly workspace: { readonly activeViewId: string | null; readonly savedViews: readonly Pick<SavedView, 'id' | 'name' | 'pinned'>[] }
  readonly targetViewId: string | null
  readonly activeVocab: VocabDefinition | null
  readonly history: { readonly canUndo: boolean; readonly canRedo: boolean }
}

export type ActionState = BaseState | ViewState

type WriteOptions = { readonly historyGroup?: string; readonly atRevision?: number }
type PluginWrites = Omit<ReturnType<typeof createWriteCommands<Promise<void>, Promise<string>>>, 'undo' | 'redo' | 'setView' | 'setActiveVocab' | 'setActiveTheme' | 'setLocale' | 'setPanelSizes' | 'setSectionOpen' | 'createView' | 'renameView' | 'setViewPinned' | 'deleteView'>
export type PluginContext<S extends BaseState = BaseState> = {
  readonly store: PluginWrites & {
    readonly getState: () => S
    readonly subscribe: (listener: () => void) => () => void
    readonly refresh: () => Promise<S>
    readonly applyOperations: (operations: readonly NessoOperation[], options?: WriteOptions) => Promise<{ readonly revision: number; readonly changed: boolean }>
  }
  readonly notifications: { readonly notify: (value: { readonly tone: 'info' | 'warning'; readonly title: LocalizedText; readonly description?: LocalizedText }) => Promise<string> }
  readonly files: { readonly open: (options: FileOpenOptions) => Promise<FileOpenResult>; readonly save: (options: FileSaveOptions) => Promise<{ readonly saved: boolean }> }
  readonly signal: AbortSignal
}
export type ActionContext = PluginContext<ActionState>

const graph = z.strictObject({ concepts: z.array(z.strictObject({ id, label: z.string(), description: z.string().optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), bold: z.boolean().optional(), italic: z.boolean().optional(), position })), relationTypes: z.array(relationType), relations: z.array(z.strictObject({ source: id, predicate: id, target: id })) })
const baseStateSchema = z.strictObject({
  revision: z.number().int().nonnegative(), contextId: id, locale,
  theme: z.strictObject(Object.fromEntries(themeTokens.map((token) => [token, z.string().max(512).regex(/^[#\w\s.,()%/"'-]*$/)]))),
  conceptPlacementOffset: position,
})
const viewStateSchema = baseStateSchema.extend({ viewGraph: graph, selected: selection, targetViewId: id.nullable(), activeVocab: z.strictObject({ id, relationTypes: z.array(relationType), defaultTypeId: id }).nullable(), history: z.strictObject({ canUndo: z.boolean(), canRedo: z.boolean() }), workspace: z.strictObject({ activeViewId: id.nullable(), savedViews: z.array(z.strictObject({ id, name: z.string(), pinned: z.boolean(), conceptIds: z.array(id).optional() })) }) })
const replies = (state: z.ZodType) => z.union([
  z.strictObject({ type: z.literal('state'), state }),
  z.strictObject({ type: z.literal('response'), id: z.number().int().positive(), ok: z.literal(true), value: z.unknown() }),
  z.strictObject({ type: z.literal('response'), id: z.number().int().positive(), ok: z.literal(false), error: wireError }),
  z.strictObject({ type: z.literal('invoke'), actionId: id, invocation: z.strictObject({ viewId: id.nullable() }) }),
  z.strictObject({ type: z.literal('close'), reason: z.string().max(2048) }),
])
type RequestMethod = z.infer<typeof request>['method']
const results = {
  'store.applyOperations': z.strictObject({ revision: z.number().int().nonnegative(), changed: z.boolean() }),
  'store.refresh': z.null(),
  'notifications.notify': id,
  'files.open': fileOpenResult,
  'files.save': z.strictObject({ saved: z.boolean() }),
} satisfies Record<RequestMethod, z.ZodType>

export function parsePluginMessage(value: unknown): z.infer<typeof message> {
  checkMessageSize(value, runtimeLimits.request)
  return parseOrThrow(message, value)
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function checkMessageSize(value: unknown, limit: number): void {
  const visit = (value: unknown, depth: number): void => {
    if (depth > 32) throw new PluginError('invalid-input', [{ path: 'message', message: 'Nesting limit exceeded' }])
    if (value === null) return
    if (typeof value === 'object') {
      if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) throw new PluginError('invalid-input', [{ path: 'message', message: 'Expected plain data' }])
      for (const item of Object.values(value)) visit(item, depth + 1)
    } else if (!['string', 'number', 'boolean', 'undefined'].includes(typeof value)) throw new PluginError('invalid-input', [{ path: 'message', message: 'Expected serializable data' }])
  }
  visit(value, 0)
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > limit) throw new PluginError('invalid-input', [{ path: 'message', message: 'Message limit exceeded' }])
}

export function createPluginClient<S extends BaseState>(port: MessagePort, initial: S) {
  const schema = 'viewGraph' in initial ? viewStateSchema : baseStateSchema
  const reply = replies(schema)
  const parsedState = parseOrThrow(schema, initial) as S
  let state = parsedState
  let sequence = 0
  const listeners = new Set<() => void>()
  const controller = new AbortController()
  const pending = new Map<number, { method: RequestMethod; resolve: (value: unknown) => void; reject: (error: PluginError) => void; timer: ReturnType<typeof setTimeout> }>()
  const close = () => {
    if (controller.signal.aborted) return
    controller.abort()
    for (const request of pending.values()) {
      clearTimeout(request.timer)
      request.reject(new PluginError('closed', [{ path: 'channel', message: 'Plugin channel closed; pending effects may already have completed' }]))
    }
    pending.clear()
    listeners.clear()
    port.postMessage({ type: 'close', reason: 'Plugin client closed' })
    port.close()
  }
  const call = async <T>(method: RequestMethod, params: unknown): Promise<T> => {
    if (controller.signal.aborted) return Promise.reject(new PluginError('closed', [{ path: 'channel', message: 'Plugin channel closed' }]))
    if (pending.size >= runtimeLimits.pending) return Promise.reject(new PluginError('failed', [{ path: 'channel', message: 'Too many pending requests' }]))
    const id = ++sequence
    const value = { type: 'request', id, contextId: state.contextId, method, params }
    parsePluginMessage(value)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(close, method.startsWith('files.') ? runtimeLimits.interaction : runtimeLimits.deadline)
      pending.set(id, { method, resolve: (value) => resolve(value as T), reject, timer })
      port.postMessage(value)
    })
  }
  port.onmessage = ({ data: value, ports }) => {
    if (controller.signal.aborted) return
    if (ports.length) { close(); return }
    const parsed = reply.safeParse(value)
    if (!parsed.success) {
      console.error(new PluginError('invalid-input', parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))).message)
      close()
      return
    }
    const data = parsed.data
    if (data.type === 'close') { close(); return }
    if (data.type === 'state' && (data.state as S).revision > state.revision) {
      state = data.state as S
      for (const listener of listeners) {
        try { listener() } catch { console.error(new PluginError('failed', [{ path: 'subscriber', message: 'Plugin state subscriber failed' }])) }
      }
    }
    if (data.type !== 'response') return
    const request = pending.get(data.id)
    if (!request) return
    if (data.ok && !results[request.method].safeParse(data.value).success) { close(); return }
    pending.delete(data.id)
    clearTimeout(request.timer)
    if (data.ok) request.resolve(data.value)
    else request.reject(new PluginError(data.error.code, data.error.issues, data.error.displayMessage))
  }
  port.onmessageerror = close
  port.start()
  const applyOperations: PluginContext<S>['store']['applyOperations'] = (operations, options) => call('store.applyOperations', { operations, ...(options ? { options } : {}) })
  const { undo: _undo, redo: _redo, setView: _view, setActiveVocab: _vocab, setActiveTheme: _theme, setLocale: _locale, setPanelSizes: _panels, setSectionOpen: _section, createView: _createView, renameView: _renameView, setViewPinned: _pin, deleteView: _deleteView, ...writes } = createWriteCommands(async (operations, options) => { await applyOperations(operations, options) }, async (id, committed) => { await committed; return id })
  const context: PluginContext<S> = {
    store: {
      ...writes,
      getState: () => state,
      subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
      refresh: async () => { await call('store.refresh', {}); return state },
      applyOperations,
    },
    notifications: { notify: (value) => call('notifications.notify', value) },
    files: { open: (options) => call('files.open', options), save: (options) => call('files.save', options) },
    signal: controller.signal,
  }
  return { context, close }
}
