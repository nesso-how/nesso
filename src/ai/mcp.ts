import type { AiResult } from '@nesso/ai'
import type { McpBridge } from '../../electron/mcp-bridge.ts'
import { NessoError } from '../store/errors.ts'
import { createAiTurn } from './turn.ts'

export function connectMcpHost(
  bridge: McpBridge,
  boundary: Parameters<typeof createAiTurn>[0],
  approve: Parameters<typeof createAiTurn>[1],
  approveHistory: (action: 'undo' | 'redo', signal: AbortSignal) => Promise<boolean>,
  busy: () => boolean,
) {
  let active: { id: string; controller: AbortController } | undefined
  const unsubscribe = bridge.subscribeTools(async (event) => {
    if (event.type === 'cancel') { if (active?.id === event.id) active.controller.abort(); return }
    if (active || busy()) { bridge.reply(event.id, { issues: [{ path: 'mcp', message: 'Another AI request is running' }] }); return }
    const controller = new AbortController()
    const signal = controller.signal
    active = { id: event.id, controller }
    const turn = createAiTurn(boundary, async () => true, signal)
    let result: AiResult<unknown>
    try {
      const value = turn.execute(event.name, event.input)
      if (event.name === 'edit' || event.name === 'history') {
        const approved = 'requiresApproval' in value ? await approve(value, signal)
          : 'action' in value ? await approveHistory(value.action, signal) : false
        if (!approved || signal.aborted) result = { value: { status: 'cancelled' } }
        else {
          const commit = await turn.commit()
          const changed = 'action' in value ? value.available : 'requiresApproval' in value && (value.memberships > 0
            || [value.concepts, value.relations, value.relationTypes, value.views].some((group) => group.added + group.updated + group.removed > 0))
          result = { value: { ...commit, status: commit.status === 'applied' && !changed ? 'unchanged' : commit.status, ...('action' in value ? value : {}) } }
        }
      } else result = { value }
    } catch (error) {
      result = { issues: error instanceof NessoError ? error.issues : [{ path: 'mcp', message: 'MCP tool execution failed' }] }
    } finally {
      turn.cancel()
      active = undefined
    }
    bridge.reply(event.id, result)
  })
  return () => { active?.controller.abort(); unsubscribe(); bridge.disconnect() }
}
