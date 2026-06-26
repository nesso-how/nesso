// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { dbClearGraphs } from '@/store/db'
import { createDesktopSyncSlice } from '@/store/slices/desktop-sync'
import { createGraphEditingSlice } from '@/store/slices/graph-editing'
import { createGraphManagementSlice } from '@/store/slices/graph-management'
import { createSettingsSlice } from '@/store/slices/settings'
import { createUISlice } from '@/store/slices/ui'
import type { GraphState } from '@/store/state'
import {
  applyOnboardingExit,
  isPersistedTour,
  resolveBootState,
  resolveGraphLoad,
  shouldStartOnboarding,
} from './onboardingFlow'

function makeStore() {
  return createStore<GraphState>()(
    (...a) =>
      ({
        ...createGraphEditingSlice(...a),
        ...createSettingsSlice(...a),
        ...createUISlice(...a),
        ...createGraphManagementSlice(...a),
        ...createDesktopSyncSlice(...a),
      }) as GraphState,
  )
}

type Store = ReturnType<typeof makeStore>

async function freshStore(): Promise<Store> {
  const s = makeStore()
  // Mirror app startup: seeds the demo graph(s) when IDB is empty.
  await s.getState().loadGraphList()
  return s
}

beforeEach(async () => {
  await dbClearGraphs()
})

describe('shouldStartOnboarding', () => {
  it('starts on a fresh install and not after completion', () => {
    const s = makeStore()
    expect(shouldStartOnboarding(s.getState())).toBe(true)
    s.getState().setSetting('onboardingCompleted', true)
    expect(shouldStartOnboarding(s.getState())).toBe(false)
  })
})

describe('applyOnboardingExit', () => {
  it('returns consent and leaves the seeded graphs untouched', async () => {
    const s = await freshStore()
    const before = s.getState().graphList.length
    expect(before).toBeGreaterThan(0)
    expect(applyOnboardingExit(s)).toBe('consent')
    expect(s.getState().graphList).toHaveLength(before)
  })

  it('returns finish when the telemetry prompt was already shown', async () => {
    const s = await freshStore()
    s.getState().setSetting('telemetryPromptShown', true)
    expect(applyOnboardingExit(s)).toBe('finish')
  })

  it('clears the active tour step on exit', async () => {
    const s = await freshStore()
    s.getState().setOnboardingStep(3)
    s.getState().setOnboardingDeleteNodeDone(true)
    applyOnboardingExit(s)
    expect(s.getState().onboardingStep).toBeNull()
    expect(s.getState().onboardingDeleteNodeDone).toBe(false)
  })

  it('persists consent phase when telemetry prompt was not shown', async () => {
    const s = await freshStore()
    s.getState().setOnboardingStep(2)
    s.getState().setOnboardingTourGraphId('tour-graph')
    s.getState().setOnboardingReviewOpened(true)
    expect(applyOnboardingExit(s)).toBe('consent')
    expect(s.getState().onboardingPhase).toBe('consent')
    expect(s.getState().onboardingStep).toBeNull()
    expect(s.getState().onboardingTourGraphId).toBeNull()
    expect(s.getState().onboardingReviewOpened).toBe(false)
  })

  it('clears consent phase when telemetry was already shown', async () => {
    const s = await freshStore()
    s.getState().setOnboardingPhase('consent')
    s.getState().setSetting('telemetryPromptShown', true)
    expect(applyOnboardingExit(s)).toBe('finish')
    expect(s.getState().onboardingPhase).toBeNull()
  })
})

describe('isPersistedTour', () => {
  it('is true for an in-progress first-run tour', () => {
    const s = makeStore()
    s.getState().setOnboardingStep(4)
    expect(isPersistedTour(s.getState())).toBe(true)
  })

  it('is true for replay from About even when onboarding is completed', () => {
    const s = makeStore()
    s.getState().setSetting('onboardingCompleted', true)
    s.getState().setOnboardingPhase('tour')
    s.getState().setOnboardingStep(0)
    expect(isPersistedTour(s.getState())).toBe(true)
  })
})

describe('resolveBootState', () => {
  it('resumes a persisted tour on reload', () => {
    const s = makeStore()
    s.getState().setOnboardingPhase('tour')
    s.getState().setOnboardingStep(5)
    s.getState().setOnboardingTourGraphId('g-tour')
    s.getState().setOnboardingReviewOpened(true)
    expect(resolveBootState(s.getState())).toEqual({
      phase: 'tour',
      tourStep: 5,
    })
  })

  it('returns consent when that phase was persisted', () => {
    const s = makeStore()
    s.getState().setOnboardingPhase('consent')
    expect(resolveBootState(s.getState())).toEqual({
      phase: 'consent',
      tourStep: 0,
    })
  })

  it('returns idle when onboarding is completed and no tour is active', () => {
    const s = makeStore()
    s.getState().setSetting('onboardingCompleted', true)
    expect(resolveBootState(s.getState())).toEqual({
      phase: 'idle',
      tourStep: 0,
    })
  })
})

describe('resolveGraphLoad', () => {
  it('resumes tour replay after graph list load', () => {
    const s = makeStore()
    s.getState().setSetting('onboardingCompleted', true)
    s.getState().setOnboardingPhase('tour')
    s.getState().setOnboardingStep(1)
    expect(resolveGraphLoad(s.getState())).toEqual({
      phase: 'tour',
      tourStep: 1,
    })
  })

  it('returns welcome on a fresh install', () => {
    const s = makeStore()
    expect(resolveGraphLoad(s.getState())).toEqual({
      phase: 'welcome',
      tourStep: 0,
    })
  })

  it('returns null when onboarding is completed and no tour is in progress', () => {
    const s = makeStore()
    s.getState().setSetting('onboardingCompleted', true)
    expect(resolveGraphLoad(s.getState())).toBeNull()
  })
})
