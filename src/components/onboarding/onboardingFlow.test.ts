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
import { applyOnboardingExit, shouldStartOnboarding } from './onboardingFlow'

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
  // Mirror app startup: creates the empty Tutorial graph when IDB is empty.
  await s.getState().loadGraphList()
  return s
}

const graphNames = (s: Store): string[] => s.getState().graphList.map((g) => g.name)

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
  it('completing the tour opens the seed map and keeps the Tutorial graph', async () => {
    const s = await freshStore()
    const result = await applyOnboardingExit(s, false)
    expect(result).toBe('consent')
    expect(graphNames(s)).toContain('Tutorial')
    expect(s.getState().graphList).toHaveLength(2)
  })

  it('skipping deletes the Tutorial graph and opens the seed map', async () => {
    const s = await freshStore()
    const result = await applyOnboardingExit(s, true)
    expect(result).toBe('consent')
    expect(graphNames(s)).not.toContain('Tutorial')
    expect(s.getState().graphList).toHaveLength(1)
  })

  it('returns finish when the telemetry prompt was already shown', async () => {
    const s = await freshStore()
    s.getState().setSetting('telemetryPromptShown', true)
    expect(await applyOnboardingExit(s, true)).toBe('finish')
  })

  it('replaying after completion does not respawn the seed map', async () => {
    const s = await freshStore()
    s.getState().setSetting('onboardingCompleted', true)
    s.getState().setSetting('telemetryPromptShown', true)
    const before = s.getState().graphList.length
    const result = await applyOnboardingExit(s, false)
    expect(result).toBe('finish')
    expect(s.getState().graphList).toHaveLength(before)
  })

  it('clears the active tour step on exit', async () => {
    const s = await freshStore()
    s.getState().setOnboardingStep(3)
    await applyOnboardingExit(s, false)
    expect(s.getState().onboardingStep).toBeNull()
  })
})
