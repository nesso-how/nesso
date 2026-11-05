import { createPluginClient, PluginError, type ActionContribution } from './runtime.ts'
import { validateActions } from './module.ts'

const runtime: string = JSON.parse(
  document.querySelector<HTMLScriptElement>('#react-imports')!.textContent!,
).imports['nesso:react']
const load = (entry: string) =>
  Promise.all([
    import(entry) as Promise<{
      create: () => readonly ActionContribution[] | Promise<readonly ActionContribution[]>
    }>,
    import(runtime) as Promise<typeof import('./react.ts')>,
  ])
let modules: ReturnType<typeof load> | undefined
let cleanup: (() => void) | undefined
const bootstrap = (event: MessageEvent) => {
  if (event.source !== parent) return
  const fail = () => parent.postMessage({ type: 'worker-failed', token: event.data.token }, '*')
  if (event.data?.type === 'prepare' && !modules) {
    window.addEventListener('error', fail)
    window.addEventListener('unhandledrejection', fail)
    modules = load(event.data.entry)
    void modules
      .then(() => parent.postMessage({ type: 'worker-ready', token: event.data.token }, '*'))
      .catch(fail)
    return
  }
  if (event.data?.type !== 'bootstrap' || event.ports.length !== 1) return
  cleanup?.()
  const port = event.ports[0]
  let client: ReturnType<typeof createPluginClient> | undefined
  let root: import('react-dom/client').Root | undefined
  const unmount = () => {
    root?.unmount()
    root = undefined
  }
  const dispose = () => {
    client?.close()
    unmount()
  }
  cleanup = dispose
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
      const [module, { React, ReactDOM, ReactDOMClient }] = await modules!
      if (client.context.signal.aborted) return
      const actions = await module.create()
      validateActions(actions)
      if (client.context.signal.aborted) return
      const action = actions.find(({ id }) => id === data.actionId)
      if (!action?.ui)
        throw new PluginError('invalid-input', [{ path: 'ui', message: 'Missing action UI' }])
      root = ReactDOMClient.createRoot(document.getElementById('root')!, { onUncaughtError: fail })
      ReactDOM.flushSync(() => root!.render(React.createElement(action.ui!, client!.context)))
      if (!client.context.signal.aborted) port.postMessage({ type: 'panel-ready' })
    } catch {
      if (cleanup === dispose && !client?.context.signal.aborted) fail()
    }
  })
  port.start()
  port.postMessage({ type: 'panel-ready' })
}
window.addEventListener('pagehide', () => cleanup?.(), { once: true })
window.addEventListener('message', bootstrap)
