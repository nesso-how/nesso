import type { AiResult, AiToolResults } from '@nesso-how/ai'
import type { McpBridge } from '../../electron/mcp-bridge.ts'
import { NessoError } from '@nesso-how/errors'
import { createAiTurn } from './turn.ts'

export function connectMcpHost(
  bridge: McpBridge,
  boundary: Parameters<typeof createAiTurn>[0],
  approve: (effects: AiToolResults['edit'], signal: AbortSignal) => Promise<boolean>,
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
    const turn = createAiTurn(boundary, signal)
    let result: AiResult<unknown>
    try {
      const value = turn.execute(event.name, event.input)
      if (event.name === 'edit' || event.name === 'history') {
        const approved = event.name === 'edit'
          ? await approve(value as AiToolResults['edit'], signal)
          : await approveHistory((value as AiToolResults['history']).action, signal)
        if (!approved || signal.aborted) result = { value: { status: 'cancelled' } }
        else {
          const commit = await turn.commit()
          const effects = value as AiToolResults['edit']
          const changed = event.name === 'history'
            ? (value as AiToolResults['history']).available
            : effects.memberships > 0 || [effects.concepts, effects.relations, effects.relationTypes, effects.views].some((group) => group.added + group.updated + group.removed > 0)
          result = { value: { ...commit, status: commit.status === 'applied' && !changed ? 'unchanged' : commit.status, ...(event.name === 'history' ? value : {}) } }
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
