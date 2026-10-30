import {
  checkMessageSize,
  parseContribution,
  PluginError,
  resolvePluginText,
  runtimeLimits,
  type ActionDescriptor,
  type ActionState,
  type FileOpenOptions,
  type FileOpenResult,
  type FileSaveOptions,
} from '@nesso-how/plugin/runtime'
import { relationKey } from '@nesso-how/schema'
import type { NessoOperation } from '@nesso-how/core'
import type { HostStore } from '../store/types.ts'
import { NessoError } from '@nesso-how/errors'
import { materialize } from '../store/operations.ts'
import { listenPluginPort, type PluginMessage } from './messages.ts'

type Grant = {
  readonly pluginId: string
  readonly writes: readonly NessoOperation['kind'][]
  readonly capabilities: readonly string[]
  readonly mode?: 'panel'
  readonly invocation?: {
    readonly actionId: string
    readonly viewId: string | null
    readonly descriptors: readonly ActionDescriptor[]
  }
}

export function connectActionChannel(
  port: MessagePort,
  store: HostStore,
  grant: Grant,
  base: Pick<ActionState, 'contextId' | 'locale' | 'theme' | 'conceptPlacementOffset'>,
  effects: {
    files: {
      open: (options: FileOpenOptions) => Promise<FileOpenResult>
      save: (options: FileSaveOptions) => Promise<{ saved: boolean }>
    }
    notify: (value: { tone: 'info' | 'warning'; title: string; description?: string }) => string
    dismiss: (id: string) => void
    discovered: (descriptors: readonly ActionDescriptor[]) => void
    activated: () => void
    complete: () => void
    failed: (error: PluginError) => void
    theme?: () => Readonly<Record<string, string>>
  },
) {
  const controller = new AbortController()
  const allowed = new Set(grant.writes)
  const capabilities = new Set(grant.capabilities)
  const pending = new Set<ReturnType<typeof setTimeout>>()
  const notifications: { id: string; tone: 'info' | 'warning' }[] = []
  const instanceId = crypto.randomUUID()
  const target = grant.invocation?.viewId ?? null
  const documentId = store.getState().documentId
  let previous = store.getState()
  let revision = 0
  let registered = false
  let running = false
  let interaction = false
  let remaining = runtimeLimits.action as number
  let started = 0
  let waiting = 0
  let actionTimer: ReturnType<typeof setTimeout> | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let ping = 0
  let pong = 0
  let mounted = false
  let notificationBudget = { start: Date.now(), count: 0 }
  function fail(code: string, message: string): never {
    throw new PluginError(code, [{ path: 'action', message }])
  }
  const snapshot = (): ActionState => {
    const state = store.getState()
    const viewGraph = materialize(state.graph, { ...state.workspace, activeViewId: target })
    const concepts = new Set(viewGraph.concepts.map(({ id }) => id))
    const relations = new Set(viewGraph.relations.map(relationKey))
    return {
      ...base,
      revision,
      locale: state.preferences.locale ?? base.locale,
      theme: effects.theme?.() ?? base.theme,
      workspace: {
        activeViewId: state.workspace.activeViewId,
        savedViews: state.workspace.savedViews.map(({ id, name, pinned }) => ({
          id,
          name,
          pinned,
        })),
      },
      targetViewId: target,
      viewGraph,
      selected: state.selected.filter(({ kind, id }) =>
        (kind === 'concept' ? concepts : relations).has(id),
      ),
      activeVocab: state.vocabs.find(({ id }) => id === state.preferences.activeVocabId) ?? null,
      history: state.history,
    }
  }
  const sendState = () => {
    const state = snapshot()
    checkMessageSize(state, runtimeLimits.snapshot)
    if (!controller.signal.aborted) port.postMessage({ type: 'state', state })
  }
  const unsubscribe = store.subscribe(() => {
    const state = store.getState()
    if (!grant.invocation) {
      previous = state
      return
    }
    if (
      state.documentEpoch !== previous.documentEpoch ||
      state.documentId !== documentId ||
      (target !== null && !state.workspace.savedViews.some(({ id }) => id === target))
    ) {
      failed(
        new PluginError('stale-context', [
          { path: 'action', message: 'The action document or target view changed' },
        ]),
      )
      return
    }
    const fields = (value: typeof state) => [
      value.graph,
      value.selected,
      value.workspace.activeViewId,
      value.workspace.savedViews,
      value.preferences.locale,
      value.preferences.activeVocabId,
      value.vocabs,
      value.history,
    ]
    const before = fields(previous)
    const changed = fields(state).some((value, index) => value !== before[index])
    previous = state
    if (changed && !controller.signal.aborted) {
      revision++
      try {
        if (running) sendState()
      } catch {
        failed(
          new PluginError('failed', [{ path: 'state', message: 'Could not deliver action state' }]),
        )
      }
    }
  })
  const close = (completed = false) => {
    if (controller.signal.aborted) return
    running = false
    controller.abort()
    unsubscribe()
    clearTimeout(initialization)
    clearTimeout(actionTimer)
    clearInterval(heartbeat)
    for (const timer of pending) clearTimeout(timer)
    pending.clear()
    for (const { id, tone } of notifications) if (!completed || tone !== 'info') effects.dismiss(id)
    port.postMessage({ type: 'close', reason: 'Action instance closed' })
    port.close()
  }
  const failed = (error: PluginError) => {
    if (!controller.signal.aborted) {
      close()
      effects.failed(error)
    }
  }
  const initialization = setTimeout(
    () =>
      failed(
        new PluginError('timeout', [
          { path: 'action', message: 'Action initialization timed out' },
        ]),
      ),
    runtimeLimits.initialization,
  )
  const resume = () => {
    if (grant.mode === 'panel') return
    started = Date.now()
    actionTimer = setTimeout(
      () =>
        failed(
          new PluginError('timeout', [{ path: 'action', message: 'Action execution timed out' }]),
        ),
      Math.max(0, remaining),
    )
  }
  const assertCurrent = (context: string) => {
    if (controller.signal.aborted) fail('closed', 'Action channel closed')
    if (!running) fail('denied', 'Action effects are disabled')
    if (context !== base.contextId) fail('stale-context', 'Action context changed')
  }
  const execute = async (message: Extract<PluginMessage, { type: 'request' }>) => {
    assertCurrent(message.contextId)
    if (message.method === 'document.refresh') {
      sendState()
      return null
    }
    if (message.method === 'document.applyOperations') {
      const { operations, revision: expectedRevision, options } = message.params
      if (operations.some(({ kind }) => !allowed.has(kind)))
        fail('denied', 'Operation not declared')
      if (expectedRevision !== revision) fail('stale-state', 'Snapshot changed before commit')
      const before = revision
      store.applyOperations(operations, {
        historyGroup: options?.historyGroup ? `${instanceId}:${options.historyGroup}` : undefined,
      })
      if (before === revision) sendState()
      return { revision, changed: revision !== before }
    }
    if (
      message.method === 'storage.list' ||
      message.method === 'storage.set' ||
      message.method === 'storage.delete'
    ) {
      if (!capabilities.has('storage')) fail('denied', 'Capability not declared')
      const snapshot = () => {
        const entry = store
          .getState()
          .pluginStorage.find(({ pluginId }) => pluginId === grant.pluginId)
        return { revision: entry?.revision ?? 0, records: entry?.records ?? [] }
      }
      if (message.method === 'storage.list') return snapshot()
      const before = snapshot().revision
      if (message.method === 'storage.set') {
        const { revision, ...record } = message.params
        store.applyOperations([
          { kind: 'plugin-storage.set', pluginId: grant.pluginId, documentId, revision, record },
        ])
      } else {
        const { revision, ...key } = message.params
        store.applyOperations([
          { kind: 'plugin-storage.delete', pluginId: grant.pluginId, documentId, revision, key },
        ])
      }
      const revision = snapshot().revision
      return { revision, changed: revision !== before }
    }
    if (message.method === 'notifications.notify') {
      if (!capabilities.has('notifications')) fail('denied', 'Capability not declared')
      if (Date.now() - notificationBudget.start >= 60_000)
        notificationBudget = { start: Date.now(), count: 0 }
      if (++notificationBudget.count > 10) fail('denied', 'Notification rate limit exceeded')
      if (notifications.length === 5) effects.dismiss(notifications.shift()!.id)
      const locale = store.getState().preferences.locale ?? base.locale
      const { tone, title, description } = message.params
      const id = effects.notify({
        tone,
        title: resolvePluginText(title, locale),
        ...(description ? { description: resolvePluginText(description, locale) } : {}),
      })
      notifications.push({ id, tone: message.params.tone })
      return id
    }
    if (!capabilities.has('files')) fail('denied', 'Capability not declared')
    if (interaction) fail('unavailable', 'Another host interaction is pending')
    interaction = true
    if (grant.mode !== 'panel') remaining -= Date.now() - started
    clearTimeout(actionTimer)
    const began = Date.now()
    try {
      const result =
        message.method === 'files.open'
          ? await effects.files.open(message.params)
          : await effects.files.save(message.params)
      assertCurrent(message.contextId)
      return result
    } finally {
      waiting += Date.now() - began
      interaction = false
      if (!controller.signal.aborted) {
        if (grant.mode !== 'panel' && waiting > runtimeLimits.interaction)
          failed(
            new PluginError('timeout', [
              { path: 'action', message: 'Action host interaction budget exceeded' },
            ]),
          )
        else resume()
      }
    }
  }
  const handle = async (message: PluginMessage) => {
    if (message.type === 'pong') {
      if (grant.mode !== 'panel' || !mounted || message.id !== ping || pong === ping)
        fail('invalid-input', 'Unexpected heartbeat')
      pong = message.id
      return
    }
    if (message.type === 'panel-ready') {
      if (
        grant.mode !== 'panel' ||
        !grant.invocation ||
        !capabilities.has('ui') ||
        !grant.invocation.descriptors.some(({ id, ui }) => id === grant.invocation!.actionId && ui)
      )
        fail('denied', 'UI not authorized')
      if (!running) {
        running = true
        const state = snapshot()
        checkMessageSize(state, runtimeLimits.snapshot)
        port.postMessage({ type: 'invoke', actionId: grant.invocation.actionId, state })
      } else {
        if (mounted) fail('invalid-input', 'Repeated panel initialization')
        mounted = true
        clearTimeout(initialization)
        effects.activated()
        heartbeat = setInterval(() => {
          if (ping !== pong) {
            failed(
              new PluginError('timeout', [
                { path: 'panel', message: 'Plugin panel stopped responding' },
              ]),
            )
            return
          }
          port.postMessage({ type: 'ping', id: ++ping })
        }, runtimeLimits.heartbeat)
      }
      return
    }
    if (message.type === 'contribution') {
      if (grant.mode === 'panel') fail('denied', 'Panel discovery is disabled')
      if (registered) fail('invalid-input', 'Repeated action contribution')
      const descriptors = parseContribution('actions', message.value)
      if (descriptors.some(({ ui }) => ui) && !capabilities.has('ui'))
        fail('denied', 'UI capability not declared')
      registered = true
      clearTimeout(initialization)
      if (!grant.invocation) {
        close(true)
        effects.discovered(descriptors)
        return
      }
      if (
        JSON.stringify(descriptors) !== JSON.stringify(grant.invocation.descriptors) ||
        !descriptors.some(({ id }) => id === grant.invocation!.actionId)
      )
        fail('denied', 'Action descriptors changed after discovery')
      if (descriptors.some(({ id, ui }) => id === grant.invocation!.actionId && ui))
        fail('denied', 'UI actions require a panel channel')
      running = true
      effects.activated()
      resume()
      const state = snapshot()
      checkMessageSize(state, runtimeLimits.snapshot)
      port.postMessage({ type: 'invoke', actionId: grant.invocation.actionId, state })
      return
    }
    if (message.type === 'complete') {
      if (grant.mode === 'panel' || !running || !grant.invocation || pending.size)
        fail('invalid-input', 'Unexpected action completion')
      if (!message.ok) {
        failed(
          new PluginError(message.error.code, message.error.issues, message.error.displayMessage),
        )
        return
      }
      close(true)
      effects.complete()
      return
    }
    if (message.type === 'close') fail('failed', message.reason)
    if (message.type !== 'request') fail('invalid-input', 'Unexpected action message')
    if (pending.size >= runtimeLimits.pending)
      fail('invalid-input', 'Pending request limit exceeded')
    const timer = setTimeout(
      () =>
        failed(
          new PluginError('timeout', [{ path: 'action', message: 'Action request timed out' }]),
        ),
      message.method.startsWith('files.')
        ? Math.max(0, runtimeLimits.interaction - (grant.mode === 'panel' ? 0 : waiting))
        : runtimeLimits.deadline,
    )
    pending.add(timer)
    try {
      const value = await execute(message)
      checkMessageSize(value, runtimeLimits.snapshot)
      if (!controller.signal.aborted)
        port.postMessage({ type: 'response', id: message.id, ok: true, value })
    } catch (error) {
      const safe =
        error instanceof PluginError
          ? error
          : error instanceof NessoError
            ? new PluginError('invalid-input', error.issues)
            : new PluginError('failed', [{ path: 'action', message: 'Action request failed' }])
      if (!controller.signal.aborted)
        port.postMessage({
          type: 'response',
          id: message.id,
          ok: false,
          error: { code: safe.code, issues: safe.issues },
        })
    } finally {
      clearTimeout(timer)
      pending.delete(timer)
    }
  }
  listenPluginPort(port, () => controller.signal.aborted, handle, failed)
  return {
    close,
    signal: controller.signal,
    refreshTheme: () => {
      if (!running || controller.signal.aborted) return
      revision++
      try {
        sendState()
      } catch {
        failed(
          new PluginError('failed', [{ path: 'state', message: 'Could not deliver panel theme' }]),
        )
      }
    },
  }
}
