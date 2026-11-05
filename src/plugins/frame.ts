import { PluginError, runtimeLimits } from '@nesso-how/plugin/runtime'
import type { createPluginEntry } from './entry.ts'

export function createPluginFrame(element: HTMLIFrameElement, panel = false) {
  let guard: string | undefined
  let loaded = false
  let session:
    | { connect: () => void; close: () => void; fail: (error: PluginError) => void }
    | undefined
  let resetting: string | undefined
  const finishReset = () => {
    resetting = undefined
    window.removeEventListener('message', reset)
  }
  const clear = () => {
    finishReset()
    element.onload = null
    if (guard) element.src = 'about:blank'
    guard = undefined
    loaded = false
  }
  const discard = () => {
    const parent = guard ? element.parentNode : null
    const next = element.nextSibling
    if (parent) element.remove()
    clear()
    parent?.insertBefore(element, next)
  }
  const reset = (event: MessageEvent) => {
    if (
      !resetting ||
      event.source !== element.contentWindow ||
      event.data?.type !== 'plugin-reset' ||
      event.data.guard !== guard ||
      event.data.token !== resetting
    )
      return
    finishReset()
    session?.connect()
  }
  const start = () => {
    if (guard) return
    guard = crypto.randomUUID()
    element.onload = () => {
      if (loaded) {
        loaded = false
        if (session)
          session.fail(
            new PluginError('closed', [{ path: 'plugin', message: 'Plugin navigated away' }]),
          )
        else clear()
        return
      }
      loaded = true
      session?.connect()
    }
    const url = new URL(`plugin-runner/${panel ? 'panel' : 'actions'}.html`, document.baseURI)
    url.hash = guard
    element.src = url.href
  }
  return {
    element,
    close: () => {
      session?.close()
      discard()
    },
    load: (
      entry: ReturnType<typeof createPluginEntry>,
      connect: (
        port: MessagePort,
        ready: () => void,
        failed: (error: PluginError) => void,
      ) => { close: () => void },
      failed: (error: PluginError) => void,
    ) => {
      session?.close()
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
        session = undefined
        if (panel) {
          if (loaded && connection && element.contentWindow) {
            resetting = token
            window.addEventListener('message', reset)
            element.contentWindow.postMessage({ type: 'reset', guard, token }, '*')
          }
        } else clear()
      }
      const fail = (error: PluginError) => {
        if (disposed) return
        const unavailable = !loaded || resetting !== undefined
        stop()
        if (unavailable) clear()
        failed(error)
      }
      const loadingDeadline = () =>
        setTimeout(
          () =>
            fail(
              new PluginError('timeout', [{ path: 'plugin', message: 'Plugin loading timed out' }]),
            ),
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
        if (disposed || !loaded || resetting || source === undefined) return
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
          element.contentWindow!.postMessage(
            { type: 'bootstrap', guard, token, entry: source },
            '*',
            [channel.port2],
          )
        } catch (error) {
          channel.port1.close()
          channel.port2.close()
          fail(
            error instanceof PluginError
              ? error
              : new PluginError('failed', [
                  { path: 'plugin', message: 'Could not connect plugin' },
                ]),
          )
        }
      }
      session = { connect: connectPort, close: stop, fail }
      start()
      void entry(controller.signal)
        .then((value) => {
          if (disposed) return
          source = value
          connectPort()
        })
        .catch((error: unknown) =>
          fail(
            error instanceof PluginError
              ? error
              : new PluginError('failed', [
                  { path: 'plugin', message: 'Could not initialize plugin' },
                ]),
          ),
        )
      return {
        close: stop,
        reconnect: () => {
          if (disposed || !connection || !panel) return
          clearTimeout(deadline)
          deadline = loadingDeadline()
          connectPort()
        },
      }
    },
  }
}
