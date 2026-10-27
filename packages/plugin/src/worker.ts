import { createPluginClient, parseContribution, PluginError, type ActionContext, type ActionContribution, type ActionState } from './runtime.ts'
import { localizedText } from './i18n.ts'

const bootstrap = async (event: MessageEvent) => {
  if (event.data?.type !== 'bootstrap' || event.ports.length !== 1) return
  self.removeEventListener('message', bootstrap)
  const port = event.ports[0]
  let close: (() => void) | undefined
  try {
    const client = createPluginClient(port, event.data.state as ActionState)
    close = client.close
    const module: { create: (context: ActionContext) => readonly ActionContribution[] | Promise<readonly ActionContribution[]> } = await import(event.data.entry)
    const actions = await module.create(client.context)
    if (!Array.isArray(actions) || actions.some((action) => typeof action.run !== 'function')) throw new PluginError('invalid-input', [{ path: 'actions', message: 'Expected local action functions' }])
    if (client.context.signal.aborted) return
    let running = false
    port.addEventListener('message', ({ data }) => {
      if (data.type !== 'invoke' || running || client.context.signal.aborted) return
      running = true
      const action = actions.find(({ id }) => id === data.actionId)
      if (!action) { client.close(); return }
      void Promise.resolve().then(() => action.run(data.invocation)).then(
        () => port.postMessage({ type: 'complete', ok: true }),
        (error: unknown) => {
          const issues = error instanceof Error && 'issues' in error && Array.isArray(error.issues) && error.issues.every((issue) => typeof issue?.path === 'string' && typeof issue?.message === 'string') ? error.issues : [{ path: 'action', message: 'Action execution failed' }]
          const display = localizedText(2048).safeParse(error instanceof Error && 'displayMessage' in error ? error.displayMessage : undefined)
          const safe = new PluginError(error instanceof PluginError ? error.code : 'failed', issues, display.success ? display.data : undefined)
          port.postMessage({ type: 'complete', ok: false, error: { code: safe.code, issues: safe.issues, ...(safe.displayMessage ? { displayMessage: safe.displayMessage } : {}) } })
        },
      )
    })
    port.postMessage({ type: 'contribution', value: parseContribution('actions', actions.map(({ id, label, icon }) => ({ id, label, ...(icon !== undefined ? { icon } : {}) }))) })
  } catch {
    port.postMessage({ type: 'close', reason: 'Action initialization failed' })
    close?.()
    port.close()
  }
}
self.addEventListener('message', bootstrap)
