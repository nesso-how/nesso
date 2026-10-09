import type { NessoOperation, NessoState } from '@nesso/plugin'
import { SchemaError } from '@nesso/schema'
import { ZodError } from 'zod'
import { aiTools, type AiEffects, type AiToolResults } from '@nesso/ai'
import type { createNessoStore } from '../store/create.ts'
import { NessoError } from '../store/errors.ts'
import { summarizeEffects } from './effects.ts'
import { readAiTool } from './read.ts'

type Boundary = Pick<ReturnType<typeof createNessoStore>, 'store' | 'previewOperations'>
type Approval = (effects: AiEffects, signal: AbortSignal) => Promise<boolean>
const fail = (path: string, message: string): never => { throw new NessoError([{ path: `ai.${path}`, message }]) }
const errorOf = (error: unknown): NessoError => {
  if (error instanceof NessoError) return error
  if (error instanceof SchemaError) return new NessoError(error.issues)
  if (error instanceof ZodError) return new NessoError(error.issues.map(({ path, message }) => ({ path: `ai.${path.join('.')}`, message })))
  return new NessoError([{ path: 'ai', message: 'Tool execution failed' }])
}
const sameContext = (before: NessoState, after: NessoState): boolean =>
  before.graph === after.graph && before.workspace.savedViews === after.workspace.savedViews
  && before.workspace.activeViewId === after.workspace.activeViewId && before.selected === after.selected
  && before.vocabs === after.vocabs && before.preferences.activeVocabId === after.preferences.activeVocabId
  && before.history === after.history

export function createAiTurn(boundary: Boundary, approve: Approval, signal?: AbortSignal) {
  const base = boundary.store.getState()
  const controller = new AbortController()
  let operations: readonly NessoOperation[] = []
  let history: 'undo' | 'redo' | undefined
  let candidate: NessoState = base
  let status: 'staging' | 'committing' | 'closed' = 'staging'
  const cancel = () => {
    status = 'closed'
    operations = []
    history = undefined
    candidate = base
    signal?.removeEventListener('abort', cancel)
    controller.abort()
  }
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
  const current = () => {
    if (!sameContext(base, boundary.store.getState())) fail('stale', 'Document or context changed; start a new turn')
  }

  return {
    cancel,
    execute: (name: string, input: unknown): AiToolResults[keyof AiToolResults] => {
      try {
        if (status !== 'staging') fail('turn', 'Turn is closed or applying')
        current()
        if (name === 'edit') {
          if (history) fail('operations', 'History must be the only write in a turn')
          const batch = aiTools.edit.inputSchema.parse(input).operations
          if (operations.length + batch.length > 1000) fail('operations', 'Turn exceeds 1000 operations')
          const next = [...operations, ...batch]
          const preview = boundary.previewOperations(base, next)
          operations = next
          candidate = preview.next
          return summarizeEffects(preview)
        }
        if (name === 'history') {
          if (operations.length || history) fail('operations', 'History must be the only write in a turn')
          history = aiTools.history.inputSchema.parse(input).action
          return { action: history, available: base.history[history === 'undo' ? 'canUndo' : 'canRedo'] }
        }
        const result = readAiTool(candidate, name, input)
        if (result === undefined) return fail('tool', 'Unknown tool or view')
        return structuredClone(result)
      } catch (error) { cancel(); throw errorOf(error) }
    },
    commit: async () => {
      try {
        if (status !== 'staging') fail('turn', 'Turn is closed or applying')
        status = 'committing'
        current()
        const preview = boundary.previewOperations(base, operations)
        const effects = summarizeEffects(preview)
        if (effects.requiresApproval && !await approve(effects, controller.signal)) return { status: 'cancelled' as const, effects }
        if (controller.signal.aborted) return { status: 'cancelled' as const, effects }
        current()
        boundary.store.applyOperations(history ? [{ kind: history === 'undo' ? 'history.undo' : 'history.redo' }] : operations)
        return { status: 'applied' as const, effects }
      } catch (error) { throw errorOf(error) } finally { cancel() }
    },
  }
}
