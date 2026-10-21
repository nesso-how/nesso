import { checkMessageSize, parseContribution, PluginError, resolvePluginText, runtimeLimits, type ActionDescriptor, type ActionState, type BaseState, type FileOpenOptions, type FileOpenResult, type FileSaveOptions } from '@nesso/plugin/runtime'
import { relationKey } from '@nesso/schema'
import type { NessoOperation } from '@nesso/plugin'
import type { HostStore } from '../store/types.ts'
import { NessoError } from '@nesso/errors'
import { materialize } from '../store/operations.ts'
import { listenPluginPort, type PluginMessage } from './messages.ts'

type Grant = {
  readonly writes: readonly NessoOperation['kind'][]
  readonly capabilities: readonly string[]
  readonly reads: readonly ('view' | 'graph')[]
  readonly invocation?: { readonly actionId: string; readonly viewId: string | null; readonly descriptors: readonly ActionDescriptor[] }
}

export function connectActionChannel(port: MessagePort, store: HostStore, grant: Grant, base: BaseState, effects: {
  files: { open: (options: FileOpenOptions) => Promise<FileOpenResult>; save: (options: FileSaveOptions) => Promise<{ saved: boolean }> }
  notify: (value: { tone: 'info' | 'warning'; title: string; description?: string }) => string
  dismiss: (id: string) => void
  discovered: (descriptors: readonly ActionDescriptor[]) => void
  activated: () => void
  complete: () => void
  failed: (error: PluginError) => void
}) {
  const controller = new AbortController()
  const allowed = new Set(grant.writes)
  const capabilities = new Set(grant.capabilities)
  const pending = new Set<ReturnType<typeof setTimeout>>()
  const notifications: { id: string; tone: 'info' | 'warning' }[] = []
  const instanceId = crypto.randomUUID()
  const target = grant.invocation?.viewId ?? null
  let previous = store.getState()
  let revision = base.revision
  let registered = false
  let running = false
  let interaction = false
  let remaining = runtimeLimits.action as number
  let started = 0
  let waiting = 0
  let actionTimer: ReturnType<typeof setTimeout> | undefined
  let notificationBudget = { start: Date.now(), count: 0 }
  function fail(code: string, message: string): never { throw new PluginError(code, [{ path: 'action', message }]) }
  const snapshot = (): ActionState => {
    const state = store.getState()
    const projection = { ...base, revision, locale: state.preferences.locale ?? base.locale }
    if (!grant.invocation || !grant.reads.length) return projection
    const viewGraph = materialize(state.graph, { ...state.workspace, activeViewId: target })
    const concepts = new Set(viewGraph.concepts.map(({ id }) => id))
    const relations = new Set(viewGraph.relations.map(relationKey))
    return {
      ...projection,
      workspace: { activeViewId: state.workspace.activeViewId, savedViews: grant.reads.includes('graph') ? state.workspace.savedViews : state.workspace.savedViews.map(({ id, name, pinned }) => ({ id, name, pinned })) },
      targetViewId: target, viewGraph,
      selected: grant.reads.includes('graph') ? state.selected : state.selected.filter(({ kind, id }) => (kind === 'concept' ? concepts : relations).has(id)),
      activeVocab: state.vocabs.find(({ id }) => id === state.preferences.activeVocabId) ?? null,
      history: state.history,
      ...(grant.reads.includes('graph') ? { graph: state.graph } : {}),
    }
  }
  const sendState = () => {
    const state = snapshot()
    checkMessageSize(state, runtimeLimits.snapshot)
    if (!controller.signal.aborted) port.postMessage({ type: 'state', state })
  }
  const unsubscribe = store.subscribe(() => {
    const state = store.getState()
    if (!grant.invocation) { previous = state; return }
    if (state.documentEpoch !== previous.documentEpoch || target !== null && !state.workspace.savedViews.some(({ id }) => id === target)) {
      failed(new PluginError('stale-context', [{ path: 'action', message: 'The action document or target view changed' }]))
      return
    }
    const fields = (value: typeof state) => [value.graph, value.selected, value.workspace.activeViewId, value.workspace.savedViews, value.preferences.locale, value.preferences.activeVocabId, value.vocabs, value.history]
    const before = fields(previous)
    const changed = fields(state).some((value, index) => value !== before[index])
    previous = state
    if (changed && !controller.signal.aborted) {
      revision++
      try { sendState() } catch { failed(new PluginError('failed', [{ path: 'state', message: 'Could not deliver action state' }])) }
    }
  })
  const close = (completed = false) => {
    if (controller.signal.aborted) return
    running = false
    controller.abort()
    unsubscribe()
    clearTimeout(initialization)
    clearTimeout(actionTimer)
    for (const timer of pending) clearTimeout(timer)
    pending.clear()
    for (const { id, tone } of notifications) if (!completed || tone !== 'info') effects.dismiss(id)
    port.postMessage({ type: 'close', reason: 'Action instance closed' })
    port.close()
  }
  const failed = (error: PluginError) => { if (!controller.signal.aborted) { close(); effects.failed(error) } }
  const initialization = setTimeout(() => failed(new PluginError('timeout', [{ path: 'action', message: 'Action initialization timed out' }])), runtimeLimits.initialization)
  const resume = () => {
    started = Date.now()
    actionTimer = setTimeout(() => failed(new PluginError('timeout', [{ path: 'action', message: 'Action execution timed out' }])), Math.max(0, remaining))
  }
  const assertCurrent = (context: string) => {
    if (controller.signal.aborted) fail('closed', 'Action channel closed')
    if (!running) fail('denied', 'Action effects are disabled')
    if (context !== base.contextId) fail('stale-context', 'Action context changed')
  }
  const execute = async (message: Extract<PluginMessage, { type: 'request' }>) => {
    if (message.method === 'store.refresh') { sendState(); return null }
    if (message.method === 'store.getViewGraph') {
      if (!grant.invocation || !grant.reads.includes('graph')) fail('denied', 'Full graph read was not declared')
      sendState()
      return message.params.id === null ? store.getState().graph : store.getViewGraph(message.params.id)
    }
    assertCurrent(message.contextId)
    if (message.method === 'store.applyOperations') {
      const { operations, options } = message.params
      if (operations.some(({ kind }) => !allowed.has(kind))) fail('denied', 'Operation not declared')
      if (operations.some(({ kind }) => kind === 'document.reset')) fail('unavailable', 'Plugin reset confirmation is not available')
      if (options?.atRevision !== undefined && options.atRevision !== revision) fail('stale-state', 'Snapshot changed before commit')
      const before = revision
      store.applyOperations(operations, { historyGroup: options?.historyGroup ? `${instanceId}:${options.historyGroup}` : undefined })
      if (before === revision) sendState()
      return { revision, changed: revision !== before }
    }
    if (!capabilities.has(message.method)) fail('denied', 'Capability not declared')
    if (message.method === 'notifications.notify') {
      if (Date.now() - notificationBudget.start >= 60_000) notificationBudget = { start: Date.now(), count: 0 }
      if (++notificationBudget.count > 10) fail('denied', 'Notification rate limit exceeded')
      if (notifications.length === 5) effects.dismiss(notifications.shift()!.id)
      const locale = store.getState().preferences.locale ?? base.locale
      const { tone, title, description } = message.params
      const id = effects.notify({ tone, title: resolvePluginText(title, locale), ...(description ? { description: resolvePluginText(description, locale) } : {}) })
      notifications.push({ id, tone: message.params.tone })
      return id
    }
    if (interaction) fail('unavailable', 'Another host interaction is pending')
    interaction = true
    remaining -= Date.now() - started
    clearTimeout(actionTimer)
    const began = Date.now()
    try {
      const result = message.method === 'files.open' ? await effects.files.open(message.params) : await effects.files.save(message.params)
      assertCurrent(message.contextId)
      return result
    } finally {
      waiting += Date.now() - began
      interaction = false
      if (!controller.signal.aborted) {
        if (waiting > runtimeLimits.interaction) failed(new PluginError('timeout', [{ path: 'action', message: 'Action host interaction budget exceeded' }]))
        else resume()
      }
    }
  }
  const handle = async (message: PluginMessage) => {
    if (message.type === 'contribution') {
      if (registered) fail('invalid-input', 'Repeated action contribution')
      const descriptors = parseContribution('actions', message.value)
      registered = true
      clearTimeout(initialization)
      if (!grant.invocation) { close(true); effects.discovered(descriptors); return }
      if (JSON.stringify(descriptors) !== JSON.stringify(grant.invocation.descriptors) || !descriptors.some(({ id }) => id === grant.invocation!.actionId)) fail('denied', 'Action descriptors changed after discovery')
      running = true
      effects.activated()
      resume()
      port.postMessage({ type: 'invoke', actionId: grant.invocation.actionId, invocation: { viewId: target } })
      return
    }
    if (message.type === 'complete') {
      if (!running || !grant.invocation || pending.size) fail('invalid-input', 'Unexpected action completion')
      if (!message.ok) { failed(new PluginError(message.error.code, message.error.issues, message.error.displayMessage)); return }
      close(true)
      effects.complete()
      return
    }
    if (message.type !== 'request') fail('invalid-input', 'Unexpected action message')
    if (pending.size >= runtimeLimits.pending) fail('invalid-input', 'Pending request limit exceeded')
    const timer = setTimeout(() => failed(new PluginError('timeout', [{ path: 'action', message: 'Action request timed out' }])), message.method.startsWith('files.') ? Math.max(0, runtimeLimits.interaction - waiting) : runtimeLimits.deadline)
    pending.add(timer)
    try {
      const value = await execute(message)
      checkMessageSize(value, runtimeLimits.snapshot)
      if (!controller.signal.aborted) port.postMessage({ type: 'response', id: message.id, ok: true, value })
    } catch (error) {
      const safe = error instanceof PluginError ? error : error instanceof NessoError ? new PluginError('invalid-input', error.issues) : new PluginError('failed', [{ path: 'action', message: 'Action request failed' }])
      if (!controller.signal.aborted) port.postMessage({ type: 'response', id: message.id, ok: false, error: { code: safe.code, issues: safe.issues } })
    } finally { clearTimeout(timer); pending.delete(timer) }
  }
  listenPluginPort(port, () => controller.signal.aborted, handle, failed)
  return { snapshot, close, signal: controller.signal }
}
