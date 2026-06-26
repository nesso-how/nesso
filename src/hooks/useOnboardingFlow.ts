// SPDX-License-Identifier: MIT
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyOnboardingExit,
  persistOnboardingPhase,
  resolveBootState,
  resolveGraphLoad,
  type OnboardingPhase,
} from '@/components/onboarding/onboardingFlow'
import { ONBOARDING_STEPS, isOnboardingStep } from '@/components/onboarding/onboardingSteps'
import { useGraphStore } from '@/store'

export function useOnboardingFlow() {
  const boot = resolveBootState(useGraphStore.getState())
  const [phase, setPhase] = useState<OnboardingPhase>(boot.phase)
  const [tourStep, setTourStep] = useState(boot.tourStep)
  const graphListReady = useRef(false)

  const setSetting = useGraphStore((s) => s.setSetting)
  const clearOnboardingPersist = useGraphStore((s) => s.clearOnboardingPersist)
  const setInspectorCollapsed = useGraphStore((s) => s.setInspectorCollapsed)
  const setSidebarCollapsed = useGraphStore((s) => s.setSidebarCollapsed)
  const setSelected = useGraphStore((s) => s.setSelected)
  const setOnboardingReviewOpened = useGraphStore((s) => s.setOnboardingReviewOpened)
  const setOnboardingTourGraphId = useGraphStore((s) => s.setOnboardingTourGraphId)
  const setOnboardingDeleteNodeDone = useGraphStore((s) => s.setOnboardingDeleteNodeDone)
  const currentGraphId = useGraphStore((s) => s.currentGraphId)
  const onboardingTourGraphId = useGraphStore((s) => s.onboardingTourGraphId)
  const firstNodeId = useGraphStore((s) => s.nodes[0]?.id ?? null)
  const secondNodeId = useGraphStore((s) => s.nodes[1]?.id ?? null)

  const finishOnboarding = useCallback(() => {
    clearOnboardingPersist()
    setSetting('onboardingCompleted', true)
    setPhase('idle')
  }, [clearOnboardingPersist, setSetting])

  const goToConsentOrFinish = useCallback(() => {
    const next = applyOnboardingExit(useGraphStore)
    if (next === 'finish') finishOnboarding()
    else setPhase('consent')
  }, [finishOnboarding])

  const startTour = useCallback(() => {
    setTourStep(0)
    setOnboardingReviewOpened(false)
    setOnboardingTourGraphId(null)
    setOnboardingDeleteNodeDone(false)
    setPhase('tour')
  }, [setOnboardingReviewOpened, setOnboardingTourGraphId, setOnboardingDeleteNodeDone])

  const skipOnboarding = useCallback(() => {
    goToConsentOrFinish()
  }, [goToConsentOrFinish])

  const advanceTour = useCallback(() => {
    if (tourStep >= ONBOARDING_STEPS.length - 1) {
      goToConsentOrFinish()
      return
    }
    const next = tourStep + 1
    setTourStep(next)
    if (isOnboardingStep(next, 'delete-node')) {
      setOnboardingDeleteNodeDone(false)
    }
  }, [tourStep, goToConsentOrFinish, setOnboardingDeleteNodeDone])

  const onGraphListLoaded = useCallback(() => {
    graphListReady.current = true
    const next = resolveGraphLoad(useGraphStore.getState())
    if (!next) return
    setTourStep(next.tourStep)
    setPhase(next.phase)
  }, [])

  const noteReviewOpenedDuringTour = useCallback(() => {
    if (phase === 'tour' && isOnboardingStep(tourStep, 'review-button')) {
      setOnboardingReviewOpened(true)
    }
  }, [phase, tourStep, setOnboardingReviewOpened])

  useEffect(() => {
    if (!graphListReady.current) return
    persistOnboardingPhase(useGraphStore.getState(), phase, tourStep)
  }, [phase, tourStep])

  useEffect(() => {
    if (
      phase === 'tour' &&
      (isOnboardingStep(tourStep, 'new-graph') ||
        isOnboardingStep(tourStep, 'name-graph') ||
        isOnboardingStep(tourStep, 'delete-graph'))
    ) {
      setSidebarCollapsed(false)
    }
  }, [phase, tourStep, setSidebarCollapsed])

  useEffect(() => {
    if (phase === 'tour' && isOnboardingStep(tourStep, 'inspector-definition')) {
      setInspectorCollapsed(false)
      if (firstNodeId) setSelected({ kind: 'node', id: firstNodeId })
    }
  }, [phase, tourStep, firstNodeId, setInspectorCollapsed, setSelected])

  useEffect(() => {
    if (
      phase === 'tour' &&
      (isOnboardingStep(tourStep, 'add-concept') ||
        isOnboardingStep(tourStep, 'second-concept') ||
        isOnboardingStep(tourStep, 'delete-node'))
    ) {
      setSelected(null)
    }
  }, [phase, tourStep, setSelected])

  useEffect(() => {
    if (phase === 'tour' && isOnboardingStep(tourStep, 'concept-label') && firstNodeId) {
      setSelected({ kind: 'node', id: firstNodeId })
    }
  }, [phase, tourStep, firstNodeId, setSelected])

  useEffect(() => {
    if (phase === 'tour' && isOnboardingStep(tourStep, 'second-concept-label')) {
      setInspectorCollapsed(true)
      if (secondNodeId) setSelected({ kind: 'node', id: secondNodeId })
    }
  }, [phase, tourStep, secondNodeId, setInspectorCollapsed, setSelected])

  useEffect(() => {
    if (phase === 'tour' && isOnboardingStep(tourStep, 'review-button')) {
      setSelected(null)
    }
  }, [phase, tourStep, setSelected])

  useEffect(() => {
    if (
      phase === 'tour' &&
      isOnboardingStep(tourStep, 'delete-graph') &&
      onboardingTourGraphId == null
    ) {
      setOnboardingTourGraphId(currentGraphId)
    }
  }, [phase, tourStep, currentGraphId, onboardingTourGraphId, setOnboardingTourGraphId])

  return {
    phase,
    tourStep,
    anyModalOpen: phase === 'welcome' || phase === 'tour',
    onGraphListLoaded,
    noteReviewOpenedDuringTour,
    finishOnboarding,
    startTour,
    skipOnboarding,
    advanceTour,
  }
}
