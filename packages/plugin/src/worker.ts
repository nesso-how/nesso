import { createPluginClient, parseContribution, PluginError, type ActionContribution } from './runtime.ts'
import { localizedText } from './i18n.ts'

const bootstrap = async (event: MessageEvent) => {
  if (event.data?.type !== 'bootstrap' || event.ports.length !== 1) return
  self.removeEventListener('message', bootstrap)
  const port = event.ports[0]
  try {
    const module: { create: () => readonly ActionContribution[] | Promise<readonly ActionContribution[]> } = await import(event.data.entry)
    const actions = await module.create()
    if (!Array.isArray(actions) || actions.some((action) => typeof action.run !== 'function')) throw new PluginError('invalid-input', [{ path: 'actions', message: 'Expected local action functions' }])
    const invoke = async ({ data }: MessageEvent) => {
      if (data?.type !== 'invoke') return
      port.removeEventListener('message', invoke)
      try {
        const client = createPluginClient(port, data.state)
        const action = actions.find(({ id }) => id === data.actionId)
        if (!action) { client.close(); return }
        await action.run(client.context)
        port.postMessage({ type: 'complete', ok: true })
      } catch (error) {
        const issues = error instanceof Error && 'issues' in error && Array.isArray(error.issues) && error.issues.every((issue) => typeof issue?.path === 'string' && typeof issue?.message === 'string') ? error.issues : [{ path: 'action', message: 'Action execution failed' }]
        const display = localizedText(2048).safeParse(error instanceof Error && 'displayMessage' in error ? error.displayMessage : undefined)
        const safe = new PluginError(error instanceof PluginError ? error.code : 'failed', issues, display.success ? display.data : undefined)
        port.postMessage({ type: 'complete', ok: false, error: { code: safe.code, issues: safe.issues, ...(safe.displayMessage ? { displayMessage: safe.displayMessage } : {}) } })
      }
    }
    port.addEventListener('message', invoke)
    port.start()
    port.postMessage({ type: 'contribution', value: parseContribution('actions', actions.map(({ id, label, icon }) => ({ id, label, ...(icon !== undefined ? { icon } : {}) }))) })
  } catch {
    port.postMessage({ type: 'close', reason: 'Action initialization failed' })
    port.close()
  }
}
self.addEventListener('message', bootstrap)
