import { createPluginClient, PluginError, type ActionContribution } from './runtime.ts'
import { resolvePluginEntry, validateActions } from './module.ts'

const bootstrap = (event: MessageEvent) => {
  if (event.source !== parent || event.data?.type !== 'bootstrap' || event.ports.length !== 1)
    return
  window.removeEventListener('message', bootstrap)
  const port = event.ports[0]
  const runtime = document.querySelector<HTMLScriptElement>('#react-runtime')!.textContent!
  const fail = () => parent.postMessage({ type: 'worker-failed', token: event.data.token }, '*')
  window.addEventListener('error', fail)
  window.addEventListener('unhandledrejection', fail)
  let client: ReturnType<typeof createPluginClient> | undefined
  let root: import('react-dom/client').Root | undefined
  const unmount = () => {
    root?.unmount()
    root = undefined
  }
  const cleanup = () => {
    client?.close()
    unmount()
  }
  window.addEventListener('pagehide', cleanup, { once: true })
  port.addEventListener('message', async ({ data }) => {
    if (data?.type !== 'invoke' || client) return
    try {
      client = createPluginClient(port, data.state)
      const applyTheme = () => {
        const { theme, locale } = client!.getPresentation()
        document.documentElement.lang = locale
        for (const [token, value] of Object.entries(theme))
          document.documentElement.style.setProperty(`--${token}`, value)
      }
      applyTheme()
      client.context.document.subscribe(applyTheme)
      client.context.signal.addEventListener('abort', unmount, { once: true })
      const module: {
        create: () => readonly ActionContribution[] | Promise<readonly ActionContribution[]>
      } = await import(await resolvePluginEntry(event.data.entry, runtime))
      const actions = await module.create()
      validateActions(actions)
      if (client.context.signal.aborted) return
      const action = actions.find(({ id }) => id === data.actionId)
      if (!action?.ui)
        throw new PluginError('invalid-input', [{ path: 'ui', message: 'Missing action UI' }])
      const { React, ReactDOM, ReactDOMClient }: typeof import('./react.ts') = await import(runtime)
      if (client.context.signal.aborted) return
      root = ReactDOMClient.createRoot(document.getElementById('root')!, { onUncaughtError: fail })
      ReactDOM.flushSync(() => root!.render(React.createElement(action.ui!, client!.context)))
      if (!client.context.signal.aborted) port.postMessage({ type: 'panel-ready' })
    } catch {
      fail()
    }
  })
  port.start()
  port.postMessage({ type: 'panel-ready' })
}
window.addEventListener('message', bootstrap)
