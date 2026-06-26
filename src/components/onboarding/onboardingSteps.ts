// SPDX-License-Identifier: MIT
import { locales } from '@/i18n/registry'
import type { GraphState } from '@/store/state'

export type OnboardingStepId =
  | 'new-graph'
  | 'name-graph'
  | 'add-concept'
  | 'concept-label'
  | 'inspector-definition'
  | 'second-concept'
  | 'second-concept-label'
  | 'connect-handle'
  | 'review-button'
  | 'delete-node'
  | 'delete-graph'

export interface OnboardingStepDef {
  id: OnboardingStepId
  i18nKey:
    | 'createGraph'
    | 'nameGraph'
    | 'addConcept'
    | 'writeLabel'
    | 'addDefinition'
    | 'secondConcept'
    | 'secondLabel'
    | 'typedRelation'
    | 'review'
    | 'deleteNode'
    | 'deleteGraph'
  isComplete: (state: GraphState) => boolean
}

function firstNode(state: GraphState) {
  return state.nodes[0] ?? null
}

function secondNode(state: GraphState) {
  return state.nodes[1] ?? null
}

function defaultConceptLabel(state: GraphState): string {
  return locales[state.settings.language].canvas.newConcept
}

function untitledGraphName(state: GraphState): string {
  return locales[state.settings.language].sidebar.untitled
}

function currentGraph(state: GraphState) {
  return state.graphList.find((g) => g.id === state.currentGraphId) ?? null
}

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    id: 'new-graph',
    i18nKey: 'createGraph',
    isComplete: (s) => {
      const g = currentGraph(s)
      return s.nodes.length === 0 && g != null && g.name === untitledGraphName(s)
    },
  },
  {
    id: 'name-graph',
    i18nKey: 'nameGraph',
    isComplete: (s) => {
      const g = currentGraph(s)
      return g != null && g.name.trim() !== '' && g.name !== untitledGraphName(s)
    },
  },
  {
    id: 'add-concept',
    i18nKey: 'addConcept',
    isComplete: (s) => s.nodes.length >= 1,
  },
  {
    id: 'concept-label',
    i18nKey: 'writeLabel',
    isComplete: (s) => {
      const node = firstNode(s)
      return node != null && node.data.text.trim() !== defaultConceptLabel(s)
    },
  },
  {
    id: 'inspector-definition',
    i18nKey: 'addDefinition',
    isComplete: (s) => {
      const node = firstNode(s)
      return (node?.data.elaboration?.definition?.trim() ?? '') !== ''
    },
  },
  {
    id: 'second-concept',
    i18nKey: 'secondConcept',
    isComplete: (s) => s.nodes.length >= 2,
  },
  {
    id: 'second-concept-label',
    i18nKey: 'secondLabel',
    isComplete: (s) => {
      const node = secondNode(s)
      return node != null && node.data.text.trim() !== defaultConceptLabel(s)
    },
  },
  {
    id: 'connect-handle',
    i18nKey: 'typedRelation',
    isComplete: (s) => s.edges.length >= 1,
  },
  {
    id: 'review-button',
    i18nKey: 'review',
    isComplete: (s) => s.onboardingReviewOpened === true,
  },
  {
    id: 'delete-node',
    i18nKey: 'deleteNode',
    isComplete: (s) => s.onboardingDeleteNodeDone === true,
  },
  {
    id: 'delete-graph',
    i18nKey: 'deleteGraph',
    isComplete: (s) =>
      s.onboardingTourGraphId != null && !s.graphList.some((g) => g.id === s.onboardingTourGraphId),
  },
]

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length

/** True when the active tour step (store `onboardingStep`) is the one with `id`. */
export function isOnboardingStep(step: number | null, id: OnboardingStepId): boolean {
  return step != null && ONBOARDING_STEPS[step]?.id === id
}
