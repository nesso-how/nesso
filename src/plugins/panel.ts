import { defaultLocale } from '@nesso-how/i18n'
import { PluginError, resolvePluginText, type ActionDescriptor } from '@nesso-how/plugin/runtime'
import type { Notifications } from '@nesso-how/core'
import type { FileBridge } from '../../shared/files.ts'
import type { HostStore } from '../store/types.ts'
import { loadActions, type ActionPackage } from './actions.ts'
import { createPluginFrame } from './frame.ts'

const retainedPlugins = ['@nesso-how/notes', '@nesso-how/review']

type Invocation = {
  readonly actionId: string
  readonly viewId: string | null
  readonly descriptors: readonly ActionDescriptor[]
}
type Panel = {
  readonly id: string
  readonly frameId: string
  readonly actionId: string
  readonly pluginName: string
  readonly title: string
  readonly viewName: string | null
  readonly status: 'loading' | 'ready' | 'failed'
}
type Frame = {
  id: string
  source: ActionPackage
  ready: Promise<void>
  warmed: () => void
  runtime?: ReturnType<typeof createPluginFrame>
}

export function createPluginPanel(
  store: HostStore,
  notifications: Notifications,
  bridge?: FileBridge,
  terminate?: (url: string) => void,
) {
  let current: Panel | null = null
  let session: { source: ActionPackage; start: () => void; close: () => void } | undefined
  let frames: Frame[] = []
  const listeners = new Set<() => void>()
  const publish = () => {
    for (const listener of listeners) listener()
  }
  const close = () => session?.close()
  const remove = (frame: Frame) => {
    frames = frames.filter((item) => item !== frame)
    frame.runtime?.close()
    frame.runtime = undefined
    frame.warmed()
    publish()
  }
  const invalidate = (name?: string) => {
    if (!name || session?.source.name === name) close()
    for (const frame of frames) if (!name || frame.source.name === name) remove(frame)
  }
  const prepare = (source: ActionPackage) => {
    const existing = frames.find((frame) => frame.source.name === source.name)
    if (existing?.source === source) return existing
    if (existing) remove(existing)
    let warmed!: () => void
    const ready = new Promise<void>((resolve) => {
      warmed = resolve
    })
    const frame: Frame = { id: crypto.randomUUID(), source, ready, warmed }
    frames = [...frames, frame]
    publish()
    return frame
  }
  let document = store.getState()
  store.subscribe(() => {
    const next = store.getState()
    if (next.documentId !== document.documentId || next.documentEpoch !== document.documentEpoch)
      invalidate()
    document = next
  })
  return {
    getSnapshot: () => current,
    getFrames: () => frames,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    close,
    invalidate,
    preload: (sources: readonly ActionPackage[]) =>
      Promise.all(
        sources
          .filter(({ name }) => retainedPlugins.includes(name))
          .map((source) => prepare(source).ready),
      ),
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
        const id = crypto.randomUUID()
        let target = invocation
        let activeViewId = state.workspace.activeViewId
        let detach: (() => void) | undefined
        const end = () => {
          if (session?.close !== end) return
          session = undefined
          current = null
          signal.removeEventListener('abort', end)
          unsubscribe()
          detach?.()
          if (!retainedPlugins.includes(source.name))
            for (const frame of frames) if (frame.source === source) remove(frame)
          publish()
          resolve()
        }
        const mount = () => {
          detach?.()
          detach = undefined
          const next = store.getState()
          const locale = next.preferences.locale ?? defaultLocale
          const frame = prepare(source)
          current = {
            id,
            frameId: frame.id,
            actionId: target.actionId,
            pluginName: resolvePluginText(source.i18n.metadata.name, locale),
            title: resolvePluginText(action.label, locale),
            viewName:
              next.workspace.savedViews.find(({ id }) => id === target.viewId)?.name ?? null,
            status: 'loading',
          }
          publish()
          const runtime = frame.runtime
          if (!runtime) return
          const controller = new AbortController()
          const update = (status: Panel['status']) => {
            if (controller.signal.aborted || current?.id !== id) return
            current = { ...current, status }
            publish()
          }
          detach = () => controller.abort()
          void loadActions(store, source, notifications, bridge, target, controller.signal, {
            frame: runtime,
            ready: () => update('ready'),
            unresponsive:
              terminate &&
              (() => {
                terminate(runtime.element.src)
                for (const item of frames) if (item !== frame) remove(item)
              }),
          }).catch(() => update('failed'))
        }
        const unsubscribe = store.subscribe(() => {
          const next = store.getState()
          if (
            target.viewId !== null &&
            !next.workspace.savedViews.some(({ id }) => id === target.viewId)
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
        session = { source, start: mount, close: end }
        signal.addEventListener('abort', end, { once: true })
        mount()
      })
    },
    mount: (id: string, element: HTMLIFrameElement) => {
      const frame = frames.find((frame) => frame.id === id)
      if (!frame) return
      element.title = frame.source.name
      const runtime = createPluginFrame(element, frame.source.entry, true, () => remove(frame))
      frame.runtime = runtime
      void runtime.ready.then(frame.warmed, () => {})
      if (current?.frameId === id) session?.start()
      return () => {
        runtime.close()
        if (frame.runtime === runtime) frame.runtime = undefined
      }
    },
  }
}
