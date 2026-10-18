import { createPluginClient, parseContribution, PluginError, type BaseState, type PluginContext } from './runtime.ts'

const bootstrap = async (event: MessageEvent) => {
  if (event.source !== parent || event.data?.type !== 'bootstrap' || event.data.mode !== 'definition' || event.ports.length !== 1) return
  window.removeEventListener('message', bootstrap)
  const port = event.ports[0]
  let close: (() => void) | undefined
  try {
    const client = createPluginClient(port, event.data.state as BaseState)
    close = client.close
    const module: { create: (context: PluginContext) => unknown } = await import(event.data.entry)
    const definition = await module.create(client.context)
    if (!client.context.signal.aborted) port.postMessage({ type: 'contribution', value: parseContribution(event.data.kind, definition) })
  } catch {
    port.postMessage({ type: 'close', reason: new PluginError('failed', [{ path: 'definition', message: 'Definition initialization failed' }]).message })
    close?.()
    port.close()
  }
}
window.addEventListener('message', bootstrap)
