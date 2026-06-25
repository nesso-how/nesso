// SPDX-License-Identifier: MIT
import { useCallback, useEffect, useState } from 'react'
import { applyOnboardingExit, shouldStartOnboarding } from '@/components/onboarding/onboardingFlow'
import { ONBOARDING_STEPS, isOnboardingStep } from '@/components/onboarding/onboardingSteps'
import { useGraphStore } from '@/store'

export type OnboardingPhase = 'idle' | 'welcome' | 'tour' | 'consent'

export function useOnboardingFlow() {
  const [phase, setPhase] = useState<OnboardingPhase>('idle')
  const [tourStep, setTourStep] = useState(0)
  const [reviewOpenedDuringTour, setReviewOpenedDuringTour] = useState(false)

  const setSetting = useGraphStore((s) => s.setSetting)
  const setOnboardingStep = useGraphStore((s) => s.setOnboardingStep)
  const setInspectorCollapsed = useGraphStore((s) => s.setInspectorCollapsed)
  const setSelected = useGraphStore((s) => s.setSelected)

  const finishOnboarding = useCallback(() => {
    setOnboardingStep(null)
    setSetting('onboardingCompleted', true)
    setPhase('idle')
  }, [setOnboardingStep, setSetting])

  const goToConsentOrFinish = useCallback(
    async (skipped = false) => {
      const next = await applyOnboardingExit(useGraphStore, skipped)
      if (next === 'finish') finishOnboarding()
      else setPhase('consent')
    },
    [finishOnboarding],
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

  const onGraphListLoaded = useCallback(() => {
    if (shouldStartOnboarding(useGraphStore.getState())) {
      setPhase('welcome')
    }
  }, [])

  const noteReviewOpenedDuringTour = useCallback(() => {
    if (phase === 'tour' && isOnboardingStep(tourStep, 'review-button')) {
      setReviewOpenedDuringTour(true)
    }
  }, [phase, tourStep])

  useEffect(() => {
    if (phase === 'tour') setOnboardingStep(tourStep)
    else setOnboardingStep(null)
  }, [phase, tourStep, setOnboardingStep])

  useEffect(() => {
    if (phase === 'tour' && isOnboardingStep(tourStep, 'inspector-definition')) {
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
  }
}
