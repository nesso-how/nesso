import { PluginError, runtimeLimits } from '@nesso-how/plugin/runtime'
import type { createPluginEntry } from './entry.ts'

export function loadPluginFrame(
  element: HTMLIFrameElement,
  assets: { entry: ReturnType<typeof createPluginEntry>; panel?: boolean },
  connect: (
    port: MessagePort,
    ready: () => void,
    failed: (error: PluginError) => void,
  ) => {
    close: () => void
  },
  failed: (error: PluginError) => void,
) {
  const controller = new AbortController()
  const token = crypto.randomUUID()
  let connection: ReturnType<typeof connect> | undefined
  let source: string | undefined
  let generation = 0
  let disposed = false
  const stop = () => {
    if (disposed) return
    disposed = true
    clearTimeout(deadline)
    controller.abort()
    window.removeEventListener('message', navigated)
    connection?.close()
    element.onload = null
    element.src = 'about:blank'
  }
  const fail = (error: PluginError) => {
    if (!disposed) {
      stop()
      failed(error)
    }
  }
  const loadingDeadline = () =>
    setTimeout(
      () =>
        fail(new PluginError('timeout', [{ path: 'plugin', message: 'Plugin loading timed out' }])),
      runtimeLimits.initialization,
    )
  let deadline = loadingDeadline()
  const navigated = (event: MessageEvent) => {
    if (
      event.source === element.contentWindow &&
      event.data?.type === 'plugin-closed' &&
      event.data.token === token
    )
      fail(new PluginError('closed', [{ path: 'plugin', message: 'Plugin navigated away' }]))
  }
  window.addEventListener('message', navigated)
  const connectPort = () => {
    const version = ++generation
    connection?.close()
    connection = undefined
    const channel = new MessageChannel()
    try {
      connection = connect(
        channel.port1,
        () => {
          if (version === generation) clearTimeout(deadline)
        },
        (error) => {
          if (version === generation) fail(error)
        },
      )
      element.contentWindow!.postMessage({ type: 'bootstrap', token, entry: source }, '*', [
        channel.port2,
      ])
    } catch (error) {
      channel.port1.close()
      channel.port2.close()
      fail(
        error instanceof PluginError
          ? error
          : new PluginError('failed', [{ path: 'plugin', message: 'Could not connect plugin' }]),
      )
    }
  }
  void assets
    .entry(controller.signal)
    .then((entry) => {
      if (disposed) return
      source = entry
      element.onload = () => {
        if (disposed) return
        if (connection) {
          fail(new PluginError('closed', [{ path: 'plugin', message: 'Plugin navigated away' }]))
          return
        }
        connectPort()
      }
      const url = new URL(
        `plugin-runner/${assets.panel ? 'panel' : 'actions'}.html`,
        document.baseURI,
      )
      url.hash = token
      element.src = url.href
    })
    .catch((error: unknown) =>
      fail(
        error instanceof PluginError
          ? error
          : new PluginError('failed', [{ path: 'plugin', message: 'Could not initialize plugin' }]),
      ),
    )
  return {
    close: stop,
    reconnect: () => {
      if (disposed || !connection || !assets.panel) return
      clearTimeout(deadline)
      deadline = loadingDeadline()
      connectPort()
    },
  }
}
