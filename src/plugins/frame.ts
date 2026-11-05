import { PluginError, runtimeLimits } from '@nesso-how/plugin/runtime'
import type { createPluginEntry } from './entry.ts'

export function createPluginFrame(
  element: HTMLIFrameElement,
  entry: ReturnType<typeof createPluginEntry>,
  panel = false,
  discarded = () => {},
) {
  const controller = new AbortController()
  const guard = crypto.randomUUID()
  let resolveReady!: () => void
  let rejectReady!: (error: PluginError) => void
  const initialized = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  let resolveLoaded!: () => void
  const loaded = new Promise<void>((resolve) => {
    resolveLoaded = resolve
  })
  let session: { close: () => void; fail: (error: PluginError) => void } | undefined
  const close = () => {
    if (controller.signal.aborted) return
    session?.close()
    controller.abort()
    clearTimeout(deadline)
    rejectReady(new PluginError('closed', [{ path: 'plugin', message: 'Plugin closed' }]))
    resolveLoaded()
    window.removeEventListener('message', message)
    element.onload = null
    element.src = 'about:blank'
  }
  const fail = (error: PluginError) => {
    if (controller.signal.aborted) return
    session?.fail(error)
    rejectReady(error)
    close()
    discarded()
  }
  const deadline = setTimeout(
    () =>
      fail(new PluginError('timeout', [{ path: 'plugin', message: 'Plugin loading timed out' }])),
    runtimeLimits.initialization,
  )
  const message = (event: MessageEvent) => {
    if (event.source !== element.contentWindow || event.data?.guard !== guard) return
    if (event.data.type === 'plugin-ready') resolveReady()
    if (event.data.type === 'plugin-closed')
      fail(new PluginError('closed', [{ path: 'plugin', message: 'Plugin content failed' }]))
  }
  window.addEventListener('message', message)
  let navigated = false
  element.onload = () => {
    if (navigated)
      fail(new PluginError('closed', [{ path: 'plugin', message: 'Plugin navigated away' }]))
    else {
      navigated = true
      resolveLoaded()
    }
  }
  const source = Promise.all([entry(controller.signal), loaded]).then(([entry]) => {
    controller.signal.throwIfAborted()
    if (panel)
      element.contentWindow!.postMessage({ type: 'prepare', guard, token: guard, entry }, '*')
    else resolveReady()
    return entry
  })
  void source.catch((error: unknown) =>
    fail(
      error instanceof PluginError
        ? error
        : new PluginError('failed', [{ path: 'plugin', message: 'Could not initialize plugin' }]),
    ),
  )
  const ready = initialized.finally(() => clearTimeout(deadline))
  void ready.catch(() => {})
  const url = new URL(`plugin-runner/${panel ? 'panel' : 'actions'}.html`, document.baseURI)
  url.hash = guard
  element.src = url.href
  return {
    element,
    ready,
    close,
    load: (
      connect: (port: MessagePort, failed: (error: PluginError) => void) => { close: () => void },
      failed: (error: PluginError) => void,
    ) => {
      session?.close()
      let connection: ReturnType<typeof connect> | undefined
      let disposed = false
      const stop = () => {
        if (disposed) return
        disposed = true
        connection?.close()
        session = undefined
      }
      const failedSession = (error: PluginError) => {
        if (disposed) return
        stop()
        failed(error)
      }
      session = { close: stop, fail: failedSession }
      void Promise.all([ready, source])
        .then(([, entry]) => {
          if (disposed) return
          const channel = new MessageChannel()
          try {
            connection = connect(channel.port1, (error) => {
              if (!disposed) fail(error)
            })
            element.contentWindow!.postMessage(
              { type: 'bootstrap', guard, token: guard, entry: panel ? undefined : entry },
              '*',
              [channel.port2],
            )
          } catch {
            channel.port1.close()
            channel.port2.close()
            fail(
              new PluginError('failed', [{ path: 'plugin', message: 'Could not connect plugin' }]),
            )
          }
        })
        .catch(failedSession)
      return { close: stop }
    },
  }
}
