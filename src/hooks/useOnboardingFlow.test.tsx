// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import { createRoot, type Root } from 'react-dom/client'
import React, { act, useRef } from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const { mockTrack } = vi.hoisted(() => ({
  mockTrack: vi.fn(),
}))

vi.mock('@/telemetry', () => ({
  track: mockTrack,
}))

import { useOnboardingFlow } from './useOnboardingFlow'

const ONBOARDING_STEPS_LENGTH = 11 // ONBOARDING_STEPS.length

let root: Root | null = null
let container: HTMLDivElement | null = null

beforeEach(() => {
  mockTrack.mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  if (root) {
    root.unmount()
    root = null
  }
  if (container) {
    container.remove()
    container = null
  }
})

/**
 * Test component that uses useOnboardingFlow and keeps a mutable ref to the
 * latest return value. Every render updates the ref, so the test can call
 * the hook's functions via `apiRef.current.advanceTour()` etc.
 */
function TestHarness({
  apiRef,
}: {
  apiRef: React.MutableRefObject<ReturnType<typeof useOnboardingFlow> | null>
}) {
  const hook = useOnboardingFlow()
  apiRef.current = hook
  return React.createElement('div')
}

async function renderHook(): Promise<
  React.MutableRefObject<ReturnType<typeof useOnboardingFlow> | null>
> {
  const apiRef: React.MutableRefObject<ReturnType<typeof useOnboardingFlow> | null> = {
    current: null,
  }
  await act(async () => {
    root = createRoot(container!)
    root!.render(React.createElement(TestHarness, { apiRef }))
  })
  return apiRef
}

describe('useOnboardingFlow telemetry', () => {
  it('emits onboarding_completed when advancing past the final tour step', async () => {
    const apiRef = await renderHook()

    // Skip the welcome → go to tour
    await act(async () => {
      apiRef.current!.startTour()
    })

    // Advance through all steps to reach past the last one
    // ONBOARDING_STEPS has 11 steps (indices 0-10).
    // After ONBOARDING_STEPS_LENGTH advances starting from step 0,
    // we go past the final step (step 10).
    for (let i = 0; i < ONBOARDING_STEPS_LENGTH; i++) {
      await act(async () => {
        apiRef.current!.advanceTour()
      })
    }

    expect(mockTrack).toHaveBeenCalledWith({
      name: 'onboarding_completed',
      props: { source: 'onboarding' },
    })
  })

  it('emits onboarding_skipped when skipOnboarding is called', async () => {
    const apiRef = await renderHook()

    await act(async () => {
      apiRef.current!.skipOnboarding()
    })

    expect(mockTrack).toHaveBeenCalledWith({
      name: 'onboarding_skipped',
      props: { source: 'onboarding' },
    })
  })
})
