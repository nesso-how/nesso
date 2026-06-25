// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { ONBOARDING_STEPS } from './onboardingSteps'
import type { GraphState } from '@/store/state'

function baseState(overrides: Partial<GraphState> = {}): GraphState {
  return {
    settings: {
      dark: false,
      language: 'en',
      edgeEncoding: 'full',
      showHeatmap: false,
      curveStyle: 'arc',
      autoCurveFlip: true,
      categoryPalette: 'default',
      aiBaseUrl: '',
      aiModel: '',
      aiApiKey: '',
      reviewEnabled: true,
      fsrsRetention: 0.9,
      maximumInterval: 365,
      inspectorMemoryOpen: true,
      inspectorExamplesOpen: true,
      inspectorRelationsOpen: true,
      knownProjects: [],
      activeProjectPath: null,
      telemetry: false,
      onboardingCompleted: false,
      telemetryPromptShown: false,
    },
    nodes: [],
    edges: [],
    ...overrides,
  } as GraphState
}

describe('ONBOARDING_STEPS.isComplete', () => {
  it('step 1 completes when a node exists', () => {
    const step = ONBOARDING_STEPS[0]
    expect(step.isComplete(baseState(), false)).toBe(false)
    expect(
      step.isComplete(
        baseState({
          nodes: [
            {
              id: 'n1',
              type: 'concept',
              position: { x: 0, y: 0 },
              data: { text: 'New concept' },
            },
          ],
        } as Partial<GraphState>),
        false,
      ),
    ).toBe(true)
  })

  it('step 2 completes when the first node is renamed', () => {
    const step = ONBOARDING_STEPS[1]
    expect(
      step.isComplete(
        baseState({
          nodes: [
            {
              id: 'n1',
              type: 'concept',
              position: { x: 0, y: 0 },
              data: { text: 'Spaced repetition' },
            },
          ],
        } as Partial<GraphState>),
        false,
      ),
    ).toBe(true)
  })

  it('step 3 completes when definition is non-empty on the first node', () => {
    const step = ONBOARDING_STEPS[2]
    expect(
      step.isComplete(
        baseState({
          nodes: [
            {
              id: 'n1',
              type: 'concept',
              position: { x: 0, y: 0 },
              data: { text: 'Idea', elaboration: { definition: 'A short definition' } },
            },
          ],
        } as Partial<GraphState>),
        false,
      ),
    ).toBe(true)
  })

  it('step 4 completes with two nodes', () => {
    const step = ONBOARDING_STEPS[3]
    const twoNodes = {
      nodes: [
        { id: 'n1', type: 'concept', position: { x: 0, y: 0 }, data: { text: 'A' } },
        { id: 'n2', type: 'concept', position: { x: 0, y: 0 }, data: { text: 'B' } },
      ],
    } as Partial<GraphState>
    expect(step.isComplete(baseState(twoNodes), false)).toBe(true)
  })

  it('step 5 completes when an edge exists', () => {
    const step = ONBOARDING_STEPS[4]
    expect(
      step.isComplete(
        baseState({
          edges: [
            { id: 'e1', source: 'n1', target: 'n2', type: 'nesso', data: { type: 'causes' } },
          ],
        } as Partial<GraphState>),
        false,
      ),
    ).toBe(true)
  })

  it('step 6 completes when review was opened during the tour', () => {
    const step = ONBOARDING_STEPS[5]
    expect(step.isComplete(baseState(), false)).toBe(false)
    expect(step.isComplete(baseState(), true)).toBe(true)
  })
})
