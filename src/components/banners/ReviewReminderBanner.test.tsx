// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import type { ConceptNodeData } from '@nesso-how/vocab-learning'
import { useGraphStore } from '@/store'
import { ReviewReminderBanner } from './ReviewReminderBanner'

let root: Root | null = null
let container: HTMLDivElement | null = null

function dueNode(): Node<ConceptNodeData> {
  return {
    id: 'due-node',
    position: { x: 0, y: 0 },
    data: {
      text: 'Due node',
      definition: '',
      due: Date.now(),
      stability: 1,
      difficulty: 5,
      reps: 1,
      lapses: 0,
      fsrsState: 2,
      lastReview: Date.now() - 1_000,
      lastRating: 3,
      learningSteps: 0,
    },
  }
}

beforeEach(() => {
  const settings = useGraphStore.getState().settings
  useGraphStore.setState({
    nodes: [dueNode()],
    edges: [],
    currentGraphId: 'graph-a',
    loadedToken: 1,
    settings: { ...settings, reviewEnabled: true, reviewReminderEnabled: true },
    reviewReminderLastShownByGraph: {},
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  root?.unmount()
  root = null
  container?.remove()
  container = null
})

function renderBanner() {
  act(() => {
    root!.render(<ReviewReminderBanner onStartReview={() => {}} onboardingActive={false} />)
  })
}

describe('ReviewReminderBanner', () => {
  it.each([
    ['review mode', { reviewEnabled: false }],
    ['review reminders', { reviewReminderEnabled: false }],
  ])('hides an open banner when %s are disabled', async (_label, setting) => {
    renderBanner()
    expect(container!.querySelector('[role="alert"]')).not.toBeNull()

    await act(async () => {
      useGraphStore.setState((state) => ({
        settings: { ...state.settings, ...setting },
      }))
    })

    expect(container!.querySelector('[role="alert"]')).toBeNull()
  })

  it('does not show a reminder when a setting is enabled after load', async () => {
    useGraphStore.setState((state) => ({
      settings: { ...state.settings, reviewEnabled: false },
    }))
    renderBanner()
    expect(container!.querySelector('[role="alert"]')).toBeNull()

    await act(async () => {
      useGraphStore.setState((state) => ({
        settings: { ...state.settings, reviewEnabled: true },
      }))
    })

    expect(container!.querySelector('[role="alert"]')).toBeNull()
    expect(useGraphStore.getState().reviewReminderLastShownByGraph).toEqual({})
  })

  it('does not render a reminder stored for a different graph', async () => {
    renderBanner()
    expect(container!.querySelector('[role="alert"]')).not.toBeNull()

    await act(async () => {
      useGraphStore.setState({ currentGraphId: 'graph-b' })
    })

    expect(container!.querySelector('[role="alert"]')).toBeNull()
  })
})
