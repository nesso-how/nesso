import { defaultLocale } from '@nesso-how/i18n'
import { PluginError, resolvePluginText, type ActionDescriptor } from '@nesso-how/plugin/runtime'
import type { Notifications } from '@nesso-how/core'
import type { FileBridge } from '../../shared/files.ts'
import type { HostStore } from '../store/types.ts'
import { loadActions, type ActionPackage } from './actions.ts'

type Invocation = {
  readonly actionId: string
  readonly viewId: string | null
  readonly descriptors: readonly ActionDescriptor[]
}
type Panel = {
  readonly id: string
  readonly pluginName: string
  readonly title: string
  readonly viewName: string | null
  readonly status: 'loading' | 'ready' | 'failed'
}

export function createPluginPanel(
  store: HostStore,
  notifications: Notifications,
  bridge?: FileBridge,
) {
  let current: Panel | null = null
  let session: { source: ActionPackage; invocation: Invocation; close: () => void } | undefined
  let detach: (() => void) | undefined
  const listeners = new Set<() => void>()
  const publish = () => {
    for (const listener of listeners) listener()
  }
  const close = () => session?.close()
  return {
    getSnapshot: () => current,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    close,
    open: (source: ActionPackage, invocation: Invocation, signal: AbortSignal) => {
      close()
      if (signal.aborted) return Promise.resolve()
      const state = store.getState()
      const action = invocation.descriptors.find(({ id }) => id === invocation.actionId)
      if (!source.manifest.capabilities.includes('ui') || !action?.ui)
        throw new PluginError('denied', [{ path: 'ui', message: 'UI not authorized' }])
      if (
        invocation.viewId !== null &&
        !state.workspace.savedViews.some(({ id }) => id === invocation.viewId)
      )
        throw new PluginError('stale-context', [
          { path: 'panel', message: 'Target view no longer exists' },
        ])
      return new Promise<void>((resolve) => {
        let target = invocation
        let activeViewId = state.workspace.activeViewId
        const end = () => {
          if (session?.close !== end) return
          session = undefined
          current = null
          signal.removeEventListener('abort', end)
          unsubscribe()
          detach?.()
          detach = undefined
          publish()
          resolve()
        }
        const mount = () => {
          detach?.()
          detach = undefined
          const next = store.getState()
          const locale = next.preferences.locale ?? defaultLocale
          session = { source, invocation: target, close: end }
          current = {
            id: crypto.randomUUID(),
            pluginName: resolvePluginText(source.i18n.metadata.name, locale),
            title: resolvePluginText(action.label, locale),
            viewName:
              next.workspace.savedViews.find(({ id }) => id === target.viewId)?.name ?? null,
            status: 'loading',
          }
          publish()
        }
        const unsubscribe = store.subscribe(() => {
          const next = store.getState()
          if (
            next.documentId !== state.documentId ||
            next.documentEpoch !== state.documentEpoch ||
            (target.viewId !== null &&
              !next.workspace.savedViews.some(({ id }) => id === target.viewId))
          ) {
            end()
            return
          }
          if (next.workspace.activeViewId !== activeViewId) {
            activeViewId = next.workspace.activeViewId
            target = { ...target, viewId: activeViewId }
            mount()
          }
        })
        signal.addEventListener('abort', end, { once: true })
        mount()
      })
    },
    attach: (frame: HTMLIFrameElement, id: string) => {
      if (!session || current?.id !== id) return () => {}
      detach?.()
      const { source, invocation } = session
      const controller = new AbortController()
      const update = (status: Panel['status']) => {
        if (controller.signal.aborted || current?.id !== id) return
        current = { ...current, status }
        publish()
      }
      void loadActions(store, source, notifications, bridge, invocation, controller.signal, {
        element: frame,
        ready: () => update('ready'),
      }).catch(() => update('failed'))
      detach = () => controller.abort()
      return detach
    },
  }
}
