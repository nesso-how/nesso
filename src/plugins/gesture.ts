import { PluginError } from '@nesso/plugin/runtime'
import type { Notifications } from '@nesso/plugin'

export function requestPluginGesture<T>(notifications: Notifications, signal: AbortSignal, options: {
  path: 'files'; title: string; description: string; cancelLabel: string
  run: () => Promise<T>; cancel: () => T; revoke?: () => void
}): Promise<T> {
  return new Promise((resolve, reject) => {
    const closed = () => new PluginError('closed', [{ path: options.path, message: 'Plugin channel closed' }])
    if (signal.aborted) { reject(closed()); return }
    let settled = false
    let acting = false
    const finish = (result: { value: T } | { error: unknown }) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', abort)
      notifications.dismiss(id)
      if ('value' in result) resolve(result.value)
      else reject(result.error instanceof PluginError ? result.error : new PluginError('unavailable', [{ path: options.path, message: 'Host interaction failed' }]))
    }
    const abort = () => { options.revoke?.(); finish({ error: closed() }) }
    const id = notifications.notify({
      tone: 'confirmation', title: options.title, description: options.description,
      action: { label: options.title, onClick: () => {
        if (settled || acting || signal.aborted) return
        acting = true
        try { void options.run().then((value) => finish({ value }), (error: unknown) => finish({ error })) }
        catch (error) { finish({ error }) }
      } },
      cancelAction: { label: options.cancelLabel, onClick: () => {
        if (settled) return
        if (acting) options.revoke?.()
        try { finish({ value: options.cancel() }) } catch (error) { finish({ error }) }
      } },
    })
    signal.addEventListener('abort', abort, { once: true })
  })
}
