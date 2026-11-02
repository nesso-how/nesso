import {
  badgeLimits,
  type ActionBadgeInput,
  type ActionBadgeResult,
} from '@nesso-how/plugin/runtime'
import type { HostStore } from '../store/types.ts'
import { materialize } from '../store/operations.ts'
import type { createPluginRegistry, PluginEntry } from './registry.ts'

type ActionPlugin = Extract<PluginEntry, { kind: 'actions' }>
type Badge = {
  actionId: string
  viewId: string | null
  pluginId: string
  listeners: Set<() => void>
  value: number | null
  refreshAt: number
  started: number
}
const key = (actionId: string, viewId: string | null) => JSON.stringify([actionId, viewId])

export function createActionBadges(
  store: HostStore,
  registry: ReturnType<typeof createPluginRegistry>,
  execute: (
    plugin: ActionPlugin,
    actionId: string,
    input: ActionBadgeInput,
    signal: AbortSignal,
  ) => Promise<ActionBadgeResult>,
) {
  const badges = new Map<string, Badge>()
  let foreground = true
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: { badge: Badge; controller: AbortController } | undefined
  let nextStart = 0
  let previous = store.getState()
  const pluginFor = (actionId: string) =>
    registry
      .getSnapshot()
      .find(
        (plugin): plugin is ActionPlugin =>
          plugin.kind === 'actions' &&
          !plugin.disabled &&
          !plugin.error &&
          plugin.contribution.some((action) => action.id === actionId && action.badge),
      )
  const publish = (badge: Badge) => {
    for (const listener of badge.listeners) listener()
  }
  const invalidate = (matches: (badge: Badge) => boolean) => {
    for (const badge of badges.values()) {
      if (!matches(badge)) continue
      badge.value = null
      badge.refreshAt = 0
      if (running?.badge === badge) running.controller.abort()
      publish(badge)
    }
    schedule()
  }
  const current = (badge: Badge) => {
    const state = store.getState()
    return (
      pluginFor(badge.actionId) &&
      (badge.viewId === null || state.workspace.savedViews.some(({ id }) => id === badge.viewId))
    )
  }
  const schedule = () => {
    clearTimeout(timer)
    if (!foreground || running || !badges.size) return
    const eligible = [...badges.values()].filter(current)
    const at = Math.min(...eligible.map((badge) => badge.refreshAt))
    if (!Number.isFinite(at)) return
    timer = setTimeout(
      run,
      Math.min(2_147_483_647, Math.max(0, at - Date.now(), nextStart - Date.now())),
    )
  }
  const run = async () => {
    const now = Date.now()
    const badge = [...badges.values()]
      .filter((entry) => current(entry) && entry.refreshAt <= now)
      .sort((a, b) => a.started - b.started)[0]
    const plugin = badge && pluginFor(badge.actionId)
    if (!badge || !plugin) {
      schedule()
      return
    }
    const controller = new AbortController()
    running = { badge, controller }
    badge.refreshAt = Infinity
    badge.pluginId = plugin.id
    badge.started = now
    nextStart = now + badgeLimits.rate
    const state = store.getState()
    const input: ActionBadgeInput = {
      viewId: badge.viewId,
      viewGraph: materialize(state.graph, { ...state.workspace, activeViewId: badge.viewId }),
      records: plugin.access?.capabilities.includes('storage')
        ? (state.pluginStorage.find(({ pluginId }) => pluginId === plugin.id)?.records ?? [])
        : [],
      now,
    }
    try {
      const result = await execute(plugin, badge.actionId, input, controller.signal)
      if (!controller.signal.aborted) {
        badge.value = result.value
        badge.refreshAt =
          result.refreshAt === undefined
            ? Infinity
            : Math.max(Date.now() + badgeLimits.refresh, result.refreshAt)
        publish(badge)
      }
    } catch {
      if (!controller.signal.aborted) {
        badge.value = null
        publish(badge)
      }
    } finally {
      running = undefined
      schedule()
    }
  }
  const unsubscribeStore = store.subscribe(() => {
    const state = store.getState()
    const documentChanged =
      state.documentId !== previous.documentId || state.documentEpoch !== previous.documentEpoch
    const graphChanged =
      state.graph !== previous.graph || state.workspace.savedViews !== previous.workspace.savedViews
    invalidate(
      (badge) =>
        documentChanged ||
        graphChanged ||
        state.pluginStorage.find(({ pluginId }) => pluginId === badge.pluginId) !==
          previous.pluginStorage.find(({ pluginId }) => pluginId === badge.pluginId),
    )
    previous = state
  })
  const unsubscribeRegistry = registry.subscribe(() => invalidate(() => true))
  return {
    getValue: (actionId: string, viewId: string | null) =>
      badges.get(key(actionId, viewId))?.value ?? null,
    watch(actionId: string, viewId: string | null, listener: () => void) {
      const plugin = pluginFor(actionId)
      if (!plugin) return () => {}
      const id = key(actionId, viewId)
      const entry: Badge = badges.get(id) ?? {
        actionId,
        viewId,
        pluginId: plugin.id,
        listeners: new Set(),
        value: null,
        refreshAt: 0,
        started: -Infinity,
      }
      badges.set(id, entry)
      entry.listeners.add(listener)
      schedule()
      return () => {
        entry.listeners.delete(listener)
        if (!entry.listeners.size) {
          badges.delete(id)
          if (running?.badge === entry) running.controller.abort()
        }
        schedule()
      }
    },
    invalidatePlugin: (pluginId: string) => invalidate((badge) => badge.pluginId === pluginId),
    setForeground(visible: boolean) {
      foreground = visible
      invalidate((badge) => (visible ? badge.refreshAt <= Date.now() : running?.badge === badge))
    },
    dispose() {
      foreground = false
      clearTimeout(timer)
      running?.controller.abort()
      badges.clear()
      unsubscribeStore()
      unsubscribeRegistry()
    },
  }
}
