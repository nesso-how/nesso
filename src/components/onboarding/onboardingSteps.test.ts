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
      mentorEnabled: false,
      reviewEnabled: true,
      fsrsRetention: 0.9,
      maximumInterval: 365,
      inspectorMemoryOpen: true,
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

const untitledGraph = (overrides: Partial<GraphState> = {}) =>
  baseState({
    currentGraphId: 'g1',
    graphList: [{ id: 'g1', name: 'Untitled', updatedAt: 0 }],
    ...overrides,
  } as Partial<GraphState>)

describe('ONBOARDING_STEPS.isComplete', () => {
  it('step 1 completes when a fresh empty graph named Untitled is current', () => {
    const step = ONBOARDING_STEPS[0]
    expect(
      step.isComplete(
        untitledGraph({
          graphList: [{ id: 'g1', name: 'Understanding', updatedAt: 0 }],
          nodes: [{ id: 'n1', type: 'concept', position: { x: 0, y: 0 }, data: { text: 'A' } }],
        } as Partial<GraphState>),
      ),
    ).toBe(false)
    expect(step.isComplete(untitledGraph())).toBe(true)
  })

  it('step 2 completes when the current graph is renamed away from Untitled', () => {
    const step = ONBOARDING_STEPS[1]
    expect(step.isComplete(untitledGraph())).toBe(false)
    expect(
      step.isComplete(
        untitledGraph({
          graphList: [{ id: 'g1', name: 'My knowledge', updatedAt: 0 }],
        } as Partial<GraphState>),
      ),
    ).toBe(true)
  })

  it('step 3 completes when a node exists', () => {
    const step = ONBOARDING_STEPS[2]
    expect(step.isComplete(baseState())).toBe(false)
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
      ),
    ).toBe(true)
  })

  it('step 4 completes when the first node is renamed', () => {
    const step = ONBOARDING_STEPS[3]
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
      ),
    ).toBe(true)
  })

  it('step 5 completes when definition is non-empty on the first node', () => {
    const step = ONBOARDING_STEPS[4]
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
      ),
    ).toBe(true)
  })

  it('step 6 completes with two nodes', () => {
    const step = ONBOARDING_STEPS[5]
    const twoNodes = {
      nodes: [
        { id: 'n1', type: 'concept', position: { x: 0, y: 0 }, data: { text: 'A' } },
        { id: 'n2', type: 'concept', position: { x: 0, y: 0 }, data: { text: 'B' } },
      ],
    } as Partial<GraphState>
    expect(step.isComplete(baseState(twoNodes))).toBe(true)
  })

  it('step 7 completes when the second node is renamed', () => {
    const step = ONBOARDING_STEPS[6]
    const twoDefault = {
      nodes: [
        { id: 'n1', type: 'concept', position: { x: 0, y: 0 }, data: { text: 'Learning' } },
        {
          id: 'n2',
          type: 'concept',
          position: { x: 0, y: 0 },
          data: { text: 'New concept' },
        },
      ],
    } as Partial<GraphState>
    expect(step.isComplete(baseState(twoDefault))).toBe(false)
    expect(
      step.isComplete(
        baseState({
          nodes: [
            { id: 'n1', type: 'concept', position: { x: 0, y: 0 }, data: { text: 'Learning' } },
            { id: 'n2', type: 'concept', position: { x: 0, y: 0 }, data: { text: 'Work' } },
          ],
        } as Partial<GraphState>),
      ),
    ).toBe(true)
  })

  it('step 8 completes when an edge exists', () => {
    const step = ONBOARDING_STEPS[7]
    expect(
      step.isComplete(
        baseState({
          edges: [
            { id: 'e1', source: 'n1', target: 'n2', type: 'nesso', data: { type: 'causes' } },
          ],
        } as Partial<GraphState>),
      ),
    ).toBe(true)
  })

  it('step 9 completes when review was opened during the tour', () => {
    const step = ONBOARDING_STEPS[8]
    expect(step.isComplete(baseState())).toBe(false)
    expect(
      step.isComplete(baseState({ onboardingReviewOpened: true } as Partial<GraphState>)),
    ).toBe(true)
  })

  it('step 10 completes when a node was deleted during the step', () => {
    const step = ONBOARDING_STEPS[9]
    expect(step.isComplete(baseState())).toBe(false)
    expect(
      step.isComplete(baseState({ onboardingDeleteNodeDone: true } as Partial<GraphState>)),
    ).toBe(true)
  })

  it('step 11 completes when the tour graph is gone from the list', () => {
    const step = ONBOARDING_STEPS[10]
    const withTourGraph = baseState({
      onboardingTourGraphId: 'tour',
      graphList: [
        { id: 'tour', name: 'Tutorial', updatedAt: 0 },
        { id: 'seed', name: 'Understanding', updatedAt: 0 },
      ],
    } as Partial<GraphState>)
    const afterDelete = baseState({
      onboardingTourGraphId: 'tour',
      graphList: [{ id: 'seed', name: 'Understanding', updatedAt: 0 }],
    } as Partial<GraphState>)
    expect(step.isComplete(withTourGraph)).toBe(false)
    expect(step.isComplete(baseState({ onboardingTourGraphId: null } as Partial<GraphState>))).toBe(
      false,
    )
    expect(step.isComplete(afterDelete)).toBe(true)
  })
})
