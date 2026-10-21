import { PluginError, resolvePluginText, themeTokens, type ActionDescriptor, type BaseState } from '@nesso/plugin/runtime'
import { defaultLocale } from '@nesso/i18n'
import type { HostStore } from '../store/types.ts'
import type { Notifications } from '@nesso/plugin'
import type { PluginI18n, PluginManifest } from '@nesso/plugin'
import type { translate } from '../i18n/index.ts'
import type { FileBridge } from '../../shared/files.ts'
import { conceptPlacementOffset } from '../store/operations.ts'
import { connectActionChannel } from './action-channel.ts'
import { loadPluginFrame } from './frame.ts'
import { createPluginFiles } from './files.ts'

export type ActionPackage = { readonly name: string; readonly entry: string | Uint8Array; readonly manifest: Extract<PluginManifest, { kind: 'actions' }>; readonly i18n: PluginI18n }

export function loadActions(store: HostStore, source: ActionPackage, notifications: Notifications, getTranslation: () => ReturnType<typeof translate>, bridge?: FileBridge, invocation?: { actionId: string; viewId: string | null; descriptors: readonly ActionDescriptor[] }, signal?: AbortSignal) {
  return new Promise<readonly ActionDescriptor[]>((resolve, reject) => {
    if (signal?.aborted) { reject(new PluginError('cancelled', [{ path: 'action', message: 'Action cancelled' }])); return }
    const frame = document.createElement('iframe')
    frame.hidden = true
    frame.title = source.name
    frame.sandbox.add('allow-scripts')
    frame.referrerPolicy = 'no-referrer'
    document.body.append(frame)
    const cleanup = () => { signal?.removeEventListener('abort', cancel); stop(); frame.remove() }
    const cancel = () => { cleanup(); reject(new PluginError('cancelled', [{ path: 'action', message: 'Action cancelled' }])) }
    const theme = getComputedStyle(document.documentElement)
    const base: BaseState = {
      revision: 0, contextId: crypto.randomUUID(), locale: store.getState().preferences.locale ?? defaultLocale,
      theme: Object.fromEntries(themeTokens.map((token) => [token, theme.getPropertyValue(`--${token}`).trim()])),
      conceptPlacementOffset,
    }
    const stop = loadPluginFrame(frame, { entry: source.entry }, (port, ready, failed) => {
      if (invocation?.viewId !== null && invocation?.viewId !== undefined && !store.getState().workspace.savedViews.some(({ id }) => id === invocation.viewId)) throw new PluginError('stale-context', [{ path: 'action', message: 'The target view no longer exists' }])
      let files: ReturnType<typeof createPluginFiles>
      const runtime = connectActionChannel(port, store, { ...source.manifest, invocation }, base, {
        files: { open: (options) => files.open(options), save: (options) => files.save(options) },
        notify: (value) => notifications.notify({ ...value, title: `${resolvePluginText(source.i18n.metadata.name, store.getState().preferences.locale ?? defaultLocale)}: ${value.title}` }),
        dismiss: notifications.dismiss,
        discovered: (descriptors) => { ready(); cleanup(); resolve(descriptors) },
        activated: ready,
        complete: () => { cleanup(); resolve(invocation!.descriptors) },
        failed,
      })
      files = createPluginFiles(bridge, notifications, runtime.signal, getTranslation)
      return { close: runtime.close, bootstrap: { mode: 'actions', kind: 'actions', state: runtime.snapshot() } }
    }, (error) => { cleanup(); reject(error) })
    signal?.addEventListener('abort', cancel, { once: true })
  })
}
