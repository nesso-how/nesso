// SPDX-License-Identifier: MIT
import type { GraphState } from '@/store/state'

export type OnboardingExit = 'consent' | 'finish'
export type OnboardingPhase = 'idle' | 'welcome' | 'tour' | 'consent'

export interface OnboardingBootState {
  phase: OnboardingPhase
  tourStep: number
}

interface FlowStore {
  getState: () => GraphState
}

type PersistStore = Pick<
  GraphState,
  | 'setOnboardingStep'
  | 'setOnboardingPhase'
  | 'setOnboardingTourGraphId'
  | 'setOnboardingReviewOpened'
>

const IDLE_BOOT: OnboardingBootState = {
  phase: 'idle',
  tourStep: 0,
}

function tourBoot(state: Pick<GraphState, 'onboardingStep'>): OnboardingBootState {
  return {
    phase: 'tour',
    tourStep: state.onboardingStep!,
  }
}

/** Tour step persisted in the store — first run or replay from About. */
export function isPersistedTour(
  state: Pick<GraphState, 'onboardingPhase' | 'onboardingStep' | 'settings'>,
): boolean {
  if (state.onboardingStep == null) return false
  if (state.onboardingPhase === 'tour') return true
  return !state.settings.onboardingCompleted
}

export function isPersistedConsent(
  state: Pick<GraphState, 'onboardingPhase' | 'settings'>,
): boolean {
  return state.onboardingPhase === 'consent' && !state.settings.telemetryPromptShown
}

/** Phase and tour progress restored on first paint after reload. */
export function resolveBootState(state: GraphState): OnboardingBootState {
  if (isPersistedConsent(state)) return { ...IDLE_BOOT, phase: 'consent' }
  if (isPersistedTour(state)) return tourBoot(state)
  return IDLE_BOOT
}

/** Phase to enter once the graph list has loaded; null leaves the current phase. */
export function resolveGraphLoad(state: GraphState): OnboardingBootState | null {
  if (isPersistedConsent(state)) return { ...IDLE_BOOT, phase: 'consent' }
  if (state.settings.onboardingCompleted && !isPersistedTour(state)) return null
  if (isPersistedTour(state)) return tourBoot(state)
  if (shouldStartOnboarding(state)) return { ...IDLE_BOOT, phase: 'welcome' }
  return null
}

/** Whether the first-run flow should start (welcome screen). */
export function shouldStartOnboarding(state: Pick<GraphState, 'settings'>): boolean {
  return !state.settings.onboardingCompleted
}

/** Mirror hook phase/step into the persisted store slice. */
export function persistOnboardingPhase(
  store: PersistStore,
  phase: OnboardingPhase,
  tourStep: number,
): void {
  if (phase === 'tour') {
    store.setOnboardingStep(tourStep)
    store.setOnboardingPhase('tour')
    return
  }
  if (phase === 'consent') {
    store.setOnboardingStep(null)
    store.setOnboardingPhase('consent')
    store.setOnboardingTourGraphId(null)
    store.setOnboardingReviewOpened(false)
    return
  }
  store.setOnboardingStep(null)
  store.setOnboardingPhase(null)
  store.setOnboardingTourGraphId(null)
  store.setOnboardingReviewOpened(false)
}

/**
 * Leaves the welcome/tour. The demo graphs are seeded at first run and the user
 * creates their own graph during the tour, so there is nothing to import or
 * clean up on exit. Returns whether the telemetry consent banner still needs to
 * show.
 */
export function applyOnboardingExit(store: FlowStore): OnboardingExit {
  const state = store.getState()
  state.setOnboardingStep(null)
  state.setOnboardingTourGraphId(null)
  state.setOnboardingReviewOpened(false)
  state.setOnboardingDeleteNodeDone(false)
  if (state.settings.telemetryPromptShown) {
    state.setOnboardingPhase(null)
    return 'finish'
  }
  state.setOnboardingPhase('consent')
  return 'consent'
}
