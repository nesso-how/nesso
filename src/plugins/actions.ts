import {
  PluginError,
  resolvePluginText,
  themeTokens,
  type ActionDescriptor,
} from '@nesso-how/plugin/runtime'
import { defaultLocale } from '@nesso-how/i18n'
import type { HostStore } from '../store/types.ts'
import type { Notifications } from '@nesso-how/core'
import type { PluginI18n, PluginManifest } from '@nesso-how/plugin'
import type { FileBridge } from '../../shared/files.ts'
import { conceptPlacementOffset } from '../store/operations.ts'
import { connectActionChannel } from './action-channel.ts'
import { loadPluginFrame } from './frame.ts'
import { createPluginFiles } from './files.ts'

export type ActionPackage = {
  readonly name: string
  readonly entry: string | Uint8Array
  readonly manifest: Extract<PluginManifest, { kind: 'actions' }>
  readonly i18n: PluginI18n
}

export function loadActions(
  store: HostStore,
  source: ActionPackage,
  notifications: Notifications,
  bridge?: FileBridge,
  invocation?: {
    actionId: string
    viewId: string | null
    descriptors: readonly ActionDescriptor[]
  },
  signal?: AbortSignal,
  panel?: { element: HTMLIFrameElement; ready: () => void },
) {
  return new Promise<readonly ActionDescriptor[]>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new PluginError('cancelled', [{ path: 'action', message: 'Action cancelled' }]))
      return
    }
    const frame = panel?.element ?? document.createElement('iframe')
    if (!panel) {
      frame.hidden = true
      frame.title = source.name
    }
    frame.sandbox.add('allow-scripts')
    frame.referrerPolicy = 'no-referrer'
    if (!panel) document.body.append(frame)
    let observer: MutationObserver | undefined
    const cleanup = () => {
      signal?.removeEventListener('abort', cancel)
      observer?.disconnect()
      stop()
      if (!panel) frame.remove()
    }
    const cancel = () => {
      cleanup()
      reject(new PluginError('cancelled', [{ path: 'action', message: 'Action cancelled' }]))
    }
    const theme = () => {
      const style = getComputedStyle(document.documentElement)
      return Object.fromEntries(
        themeTokens.map((token) => [token, style.getPropertyValue(`--${token}`).trim()]),
      )
    }
    const base = {
      contextId: crypto.randomUUID(),
      locale: store.getState().preferences.locale ?? defaultLocale,
      theme: theme(),
      conceptPlacementOffset,
    }
    const stop = loadPluginFrame(
      frame,
      { entry: source.entry, panel: !!panel },
      (port, ready, failed) => {
        if (
          invocation?.viewId !== null &&
          invocation?.viewId !== undefined &&
          !store.getState().workspace.savedViews.some(({ id }) => id === invocation.viewId)
        )
          throw new PluginError('stale-context', [
            { path: 'action', message: 'The target view no longer exists' },
          ])
        let files: ReturnType<typeof createPluginFiles>
        const runtime = connectActionChannel(
          port,
          store,
          {
            ...source.manifest,
            pluginId: source.name,
            invocation,
            ...(panel ? { mode: 'panel' } : {}),
          },
          base,
          {
            theme: panel ? theme : undefined,
            files: {
              open: (options) => files.open(options),
              save: (options) => files.save(options),
            },
            notify: (value) =>
              notifications.notify({
                ...value,
                title: `${resolvePluginText(source.i18n.metadata.name, store.getState().preferences.locale ?? defaultLocale)}: ${value.title}`,
              }),
            dismiss: notifications.dismiss,
            discovered: (descriptors) => {
              ready()
              cleanup()
              resolve(descriptors)
            },
            activated: () => {
              ready()
              panel?.ready()
            },
            complete: () => {
              cleanup()
              resolve(invocation!.descriptors)
            },
            failed,
          },
        )
        files = createPluginFiles(bridge, runtime.signal)
        if (panel) {
          observer = new MutationObserver(() => runtime.refreshTheme())
          observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['style', 'class'],
          })
        }
        return runtime
      },
      (error) => {
        cleanup()
        reject(error)
      },
    )
    signal?.addEventListener('abort', cancel, { once: true })
  })
}
