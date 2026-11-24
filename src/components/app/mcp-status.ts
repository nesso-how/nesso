import type { McpBridge, McpState } from '../../../electron/mcp/bridge.ts'

export type McpStatus = 'aiSettingsWorking' | 'mcpRunning' | 'mcpNotRunning'

export function watchMcpStatus(
  bridge: Pick<McpBridge, 'getState' | 'subscribeState'>,
  update: (status: McpStatus) => void,
) {
  let awaitingSnapshot = true
  const publish = (state: Pick<McpState, 'running' | 'changing'>) =>
    update(state.changing ? 'aiSettingsWorking' : state.running ? 'mcpRunning' : 'mcpNotRunning')
  const unsubscribe = bridge.subscribeState((state) => {
    awaitingSnapshot = false
    publish(state)
  })
  void bridge.getState().then(
    (result) => {
      if (!awaitingSnapshot) return
      if ('issues' in result) update('mcpNotRunning')
      else publish(result.value)
    },
    () => {
      if (awaitingSnapshot) update('mcpNotRunning')
    },
  )
  return () => {
    awaitingSnapshot = false
    unsubscribe()
  }
}
