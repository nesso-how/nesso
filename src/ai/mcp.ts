import {
  hasAiEffects,
  type AiDocumentation,
  type AiResult,
  type AiToolResults,
} from '@nesso-how/ai'
import type { McpBridge } from '../../electron/mcp-bridge.ts'
import { NessoError } from '@nesso-how/errors'
import { createAiTurn } from './turn.ts'
import type { HostStore } from '../store/types.ts'

export function setMcpEnabled(bridge: McpBridge, store: HostStore, enabled: boolean) {
  store.applyOperations([{ kind: 'preferences.mcpEnabled', value: enabled }])
  return bridge.setEnabled(enabled)
}

export function connectMcpHost(
  bridge: McpBridge,
  boundary: Parameters<typeof createAiTurn>[0],
  approve: (effects: AiToolResults['edit'], signal: AbortSignal) => Promise<boolean>,
  approveHistory: (action: 'undo' | 'redo', signal: AbortSignal) => Promise<boolean>,
  busy: () => boolean,
  documentation: AiDocumentation,
  reportError: (message: string) => void,
) {
  let connected = true
  let active: { id: string; controller: AbortController } | undefined
  const unsubscribe = bridge.subscribeTools(async (event) => {
    if (event.type === 'cancel') {
      if (active?.id === event.id) active.controller.abort()
      return
    }
    if (active || busy()) {
      bridge.reply(event.id, {
        issues: [{ path: 'mcp', message: 'Another AI request is running' }],
      })
      return
    }
    const controller = new AbortController()
    const signal = controller.signal
    active = { id: event.id, controller }
    const turn = createAiTurn(boundary, signal, documentation)
    let result: AiResult<unknown>
    try {
      const value = turn.execute(event.name, event.input)
      if (event.name === 'edit' || event.name === 'history') {
        const approved =
          event.name === 'edit'
            ? await approve(value as AiToolResults['edit'], signal)
            : await approveHistory((value as AiToolResults['history']).action, signal)
        if (!approved || signal.aborted) result = { value: { status: 'cancelled' } }
        else {
          const commit = await turn.commit()
          const effects = value as AiToolResults['edit']
          const changed =
            event.name === 'history'
              ? (value as AiToolResults['history']).available
              : hasAiEffects(effects)
          result = {
            value: {
              ...commit,
              status: commit.status === 'applied' && !changed ? 'unchanged' : commit.status,
              ...(event.name === 'history' ? value : {}),
            },
          }
        }
      } else result = { value }
    } catch (error) {
      result = {
        issues:
          error instanceof NessoError
            ? error.issues
            : [{ path: 'mcp', message: 'MCP tool execution failed' }],
      }
    } finally {
      turn.cancel()
      active = undefined
    }
    bridge.reply(event.id, result)
  })
  if (boundary.store.getState().preferences.mcpEnabled) {
    void bridge
      .setEnabled(true)
      .then((result) => {
        if (connected && 'issues' in result)
          reportError(result.issues.map(({ message }) => message).join('\n'))
      })
      .catch(() => {
        if (connected) reportError('MCP server operation failed')
      })
  }
  return () => {
    connected = false
    active?.controller.abort()
    unsubscribe()
    bridge.disconnect()
  }
}
