// SPDX-License-Identifier: MIT
import { getSeedsForLanguage } from '@/data/seedGraph'
import { TUTORIAL_GRAPH_NAME } from '@/store'
import type { GraphState } from '@/store/state'

export type OnboardingExit = 'consent' | 'finish'

interface FlowStore {
  getState: () => GraphState
}

/** Whether the first-run flow should start (welcome screen). */
export function shouldStartOnboarding(state: Pick<GraphState, 'settings'>): boolean {
  return !state.settings.onboardingCompleted
}

/**
 * Leaves the welcome/tour. On a real first run it opens the locale seed map
 * (and drops the empty Tutorial graph when the user skipped); a replay from
 * About is a no-op on graphs. Returns whether the telemetry consent banner
 * still needs to show.
 */
export async function applyOnboardingExit(
  store: FlowStore,
  skipped: boolean,
): Promise<OnboardingExit> {
  const state = store.getState()
  state.setOnboardingStep(null)
  const { onboardingCompleted, telemetryPromptShown, language } = state.settings
  if (!onboardingCompleted) {
    const seed = getSeedsForLanguage(language)[0]
    if (seed) await state.importGraph(seed.name, seed.nodes, seed.edges, seed.display)
    if (skipped) {
      const tutorial = store.getState().graphList.find((g) => g.name === TUTORIAL_GRAPH_NAME)
      if (tutorial) await store.getState().deleteGraph(tutorial.id)
    }
  }
  return telemetryPromptShown ? 'finish' : 'consent'
}
