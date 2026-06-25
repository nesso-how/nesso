// SPDX-License-Identifier: MIT
import { useCallback, useEffect, useState } from 'react'
import { ONBOARDING_STEPS } from '@/components/onboarding/onboardingSteps'
import { getSeedsForLanguage } from '@/data/seedGraph'
import { useGraphStore } from '@/store'

export type OnboardingPhase = 'idle' | 'welcome' | 'tour' | 'consent'

export function useOnboardingFlow() {
  const [phase, setPhase] = useState<OnboardingPhase>('idle')
  const [tourStep, setTourStep] = useState(0)
  const [reviewOpenedDuringTour, setReviewOpenedDuringTour] = useState(false)

  const telemetryPromptShown = useGraphStore((s) => s.settings.telemetryPromptShown)
  const setSetting = useGraphStore((s) => s.setSetting)
  const setOnboardingStep = useGraphStore((s) => s.setOnboardingStep)
  const setInspectorCollapsed = useGraphStore((s) => s.setInspectorCollapsed)
  const setSelected = useGraphStore((s) => s.setSelected)
  const importGraph = useGraphStore((s) => s.importGraph)
  const deleteGraph = useGraphStore((s) => s.deleteGraph)

  const finishOnboarding = useCallback(() => {
    setOnboardingStep(null)
    setSetting('onboardingCompleted', true)
    setPhase('idle')
  }, [setOnboardingStep, setSetting])

  const openSeedMap = useCallback(async () => {
    const seed = getSeedsForLanguage(useGraphStore.getState().settings.language)[0]
    if (!seed) return
    await importGraph(seed.name, seed.nodes, seed.edges, seed.display)
  }, [importGraph])

  const goToConsentOrFinish = useCallback(
    async (skipped = false) => {
      setOnboardingStep(null)
      if (!useGraphStore.getState().settings.onboardingCompleted) {
        await openSeedMap()
        if (skipped) {
          const tutorial = useGraphStore.getState().graphList.find((g) => g.name === 'Tutorial')
          if (tutorial) await deleteGraph(tutorial.id)
        }
      }
      if (telemetryPromptShown) {
        finishOnboarding()
      } else {
        setPhase('consent')
      }
    },
    [telemetryPromptShown, finishOnboarding, setOnboardingStep, openSeedMap, deleteGraph],
  )

  const startTour = useCallback(() => {
    setTourStep(0)
    setReviewOpenedDuringTour(false)
    setPhase('tour')
  }, [])

  const skipWelcome = useCallback(() => {
    void goToConsentOrFinish(true)
  }, [goToConsentOrFinish])

  const skipTour = useCallback(() => {
    void goToConsentOrFinish(true)
  }, [goToConsentOrFinish])

  const advanceTour = useCallback(() => {
    if (tourStep >= ONBOARDING_STEPS.length - 1) {
      void goToConsentOrFinish(false)
      return
    }
    setTourStep((s) => s + 1)
  }, [tourStep, goToConsentOrFinish])

  const relaunchTour = useCallback((closeAbout: () => void) => {
    closeAbout()
    setTourStep(0)
    setReviewOpenedDuringTour(false)
    setPhase('tour')
  }, [])

  const onGraphListLoaded = useCallback(() => {
    if (!useGraphStore.getState().settings.onboardingCompleted) {
      setPhase('welcome')
    }
  }, [])

  const noteReviewOpenedDuringTour = useCallback(() => {
    if (phase === 'tour' && tourStep === 5) {
      setReviewOpenedDuringTour(true)
    }
  }, [phase, tourStep])

  useEffect(() => {
    if (phase === 'tour') setOnboardingStep(tourStep)
    else setOnboardingStep(null)
  }, [phase, tourStep, setOnboardingStep])

  useEffect(() => {
    if (phase === 'tour' && tourStep === 2) {
      setInspectorCollapsed(false)
      const firstId = useGraphStore.getState().nodes[0]?.id
      if (firstId) setSelected({ kind: 'node', id: firstId })
    }
  }, [phase, tourStep, setInspectorCollapsed, setSelected])

  return {
    phase,
    tourStep,
    reviewOpenedDuringTour,
    anyModalOpen: phase === 'welcome' || phase === 'tour',
    onGraphListLoaded,
    noteReviewOpenedDuringTour,
    finishOnboarding,
    startTour,
    skipWelcome,
    skipTour,
    advanceTour,
    relaunchTour,
  }
}
