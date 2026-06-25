// SPDX-License-Identifier: MIT
import { locales } from '@/i18n/registry'
import type { GraphState } from '@/store/state'

export type OnboardingStepId =
  | 'add-concept'
  | 'concept-label'
  | 'inspector-definition'
  | 'second-concept'
  | 'connect-handle'
  | 'review-button'

export interface OnboardingStepDef {
  id: OnboardingStepId
  i18nKey:
    | 'addConcept'
    | 'writeLabel'
    | 'addDefinition'
    | 'secondConcept'
    | 'typedRelation'
    | 'review'
  isComplete: (state: GraphState, reviewOpened: boolean) => boolean
}

function firstNode(state: GraphState) {
  return state.nodes[0] ?? null
}

function defaultConceptLabel(state: GraphState): string {
  return locales[state.settings.language].canvas.newConcept
}

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
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
    id: 'connect-handle',
    i18nKey: 'typedRelation',
    isComplete: (s) => s.edges.length >= 1,
  },
  {
    id: 'review-button',
    i18nKey: 'review',
    isComplete: (_s, reviewOpened) => reviewOpened,
  },
]

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length

/** True when the active tour step (store `onboardingStep`) is the one with `id`. */
export function isOnboardingStep(step: number | null, id: OnboardingStepId): boolean {
  return step != null && ONBOARDING_STEPS[step]?.id === id
}
