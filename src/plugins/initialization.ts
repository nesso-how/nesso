import { PluginError, runtimeLimits } from '@nesso-how/plugin/runtime'

export async function withInitializationTimeout<T>(load: (signal: AbortSignal) => Promise<T>, parent: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const signal = AbortSignal.any([parent, controller.signal])
  const timer = setTimeout(() => controller.abort(new PluginError('timeout', [{ path: 'plugin', message: 'Plugin loading timed out' }])), runtimeLimits.initialization)
  let cancel: (() => void) | undefined
  try {
    signal.throwIfAborted()
    return await new Promise<T>((resolve, reject) => {
      cancel = () => reject(signal.reason)
      signal.addEventListener('abort', cancel, { once: true })
      load(signal).then(resolve, reject)
    })
  } finally {
    clearTimeout(timer)
    if (cancel) signal.removeEventListener('abort', cancel)
    controller.abort()
  }
}
