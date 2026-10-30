import type { ActionContribution, NessoOperation } from '@nesso-how/plugin'
import { Quiz } from './Quiz.js'

export const create = (): readonly ActionContribution[] => {
  const uppercase: ActionContribution = {
    id: 'uppercase-labels',
    label: { en: 'Uppercase labels' },
    run: async ({ document }) => {
      const state = document.getState()

      const operations: readonly NessoOperation[] = state.viewGraph.concepts.map(
        ({ id, label }) => ({
          kind: 'concept.label',
          id,
          value: label.toUpperCase(),
        }),
      )

      await document.applyOperations(operations)
    },
  }

  const quiz: ActionContribution = {
    id: 'concept-quiz',
    label: { en: 'Concept Quiz' },
    ui: Quiz,
    icon: 'play',
  }

  return [uppercase, quiz]
}
