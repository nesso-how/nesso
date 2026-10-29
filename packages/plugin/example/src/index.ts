import type { ActionContribution, NessoOperation } from '@nesso-how/plugin'
import source from '../package.json' with { type: 'json' }

export const create = (): readonly ActionContribution[] => {
  const action: ActionContribution = {
    id: 'uppercase-labels',
    label: source.i18n.metadata.name,
    run: async ({ document }) => {
      const state = document.getState()

      const operations: readonly NessoOperation[] = state.viewGraph.concepts.map(({ id, label }) => ({
        kind: 'concept.label',
        id,
        value: label.toUpperCase(),
      }))

      await document.applyOperations(operations)
    },
  }

  return [action]
}
