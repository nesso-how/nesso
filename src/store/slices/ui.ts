// SPDX-License-Identifier: MIT
import { isOnboardingStep } from '@/components/onboarding/onboardingSteps'
import type { StateCreator } from 'zustand'
import type { Viewport, Toast, ConfirmRequest } from '../types'
import type { GraphState } from '../state'

const MAX_TOASTS = 4

/** Persisted between reloads while first-run onboarding is in progress. */
export type OnboardingPersistPhase = 'tour' | 'consent'

export interface UISlice {
  mentorPanelExpanded: boolean
  sidebarCollapsed: boolean
  sidebarDisplayOpen: boolean
  inspectorCollapsed: boolean
  viewports: Record<string, Viewport>
  toasts: Toast[]
  confirmRequest: ConfirmRequest | null
  /** Active onboarding tour step index, or null when the tour is not running. */
  onboardingStep: number | null
  /** Mid-flow phase restored after reload (tour in progress, or telemetry consent). */
  onboardingPhase: OnboardingPersistPhase | null
  /** Graph built during the tour — delete-graph step compares against graphList. */
  onboardingTourGraphId: string | null
  /** Review sheet was opened during the tour — completes the review step. */
  onboardingReviewOpened: boolean
  /** A node was deleted during the delete-node step. */
  onboardingDeleteNodeDone: boolean
  reviewReminderLastShownByGraph: Record<string, string>
  setMentorPanelExpanded: (expanded: boolean) => void
  setSidebarCollapsed: (v: boolean) => void
  setSidebarDisplayOpen: (v: boolean) => void
  setInspectorCollapsed: (v: boolean) => void
  saveViewport: (id: string, vp: Viewport) => void
  pushToast: (toast: Toast) => void
  dismissToast: (id: string) => void
  openConfirm: (request: ConfirmRequest) => void
  closeConfirm: () => void
  setOnboardingStep: (step: number | null) => void
  setOnboardingPhase: (phase: OnboardingPersistPhase | null) => void
  setOnboardingTourGraphId: (id: string | null) => void
  setOnboardingReviewOpened: (opened: boolean) => void
  setOnboardingDeleteNodeDone: (done: boolean) => void
  noteOnboardingNodeDeleted: () => void
  clearOnboardingPersist: () => void
  markReviewReminderShown: (graphId: string, localDay: string) => void
}

export const createUISlice: StateCreator<GraphState, [], [], UISlice> = (set, get) => ({
  mentorPanelExpanded: false,
  sidebarCollapsed: false,
  sidebarDisplayOpen: true,
  inspectorCollapsed: false,
  viewports: {},
  toasts: [],
  confirmRequest: null,
  onboardingStep: null,
  onboardingPhase: null,
  onboardingTourGraphId: null,
  onboardingReviewOpened: false,
  onboardingDeleteNodeDone: false,
  reviewReminderLastShownByGraph: {},

  setMentorPanelExpanded: (expanded) => set({ mentorPanelExpanded: expanded }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setSidebarDisplayOpen: (v) => set({ sidebarDisplayOpen: v }),
  setInspectorCollapsed: (v) => set({ inspectorCollapsed: v }),

  pushToast: (toast) =>
    set((s) => ({
      toasts: [...s.toasts.filter((t) => t.id !== toast.id), toast].slice(-MAX_TOASTS),
    })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  openConfirm: (request) => set({ confirmRequest: request }),
  closeConfirm: () => set({ confirmRequest: null }),
  setOnboardingStep: (step) => set({ onboardingStep: step }),
  setOnboardingPhase: (phase) => set({ onboardingPhase: phase }),
  setOnboardingTourGraphId: (id) => set({ onboardingTourGraphId: id }),
  setOnboardingReviewOpened: (opened) => set({ onboardingReviewOpened: opened }),
  setOnboardingDeleteNodeDone: (done) => set({ onboardingDeleteNodeDone: done }),
  noteOnboardingNodeDeleted: () => {
    if (isOnboardingStep(get().onboardingStep, 'delete-node')) {
      set({ onboardingDeleteNodeDone: true })
    }
  },
  clearOnboardingPersist: () =>
    set({
      onboardingStep: null,
      onboardingPhase: null,
      onboardingTourGraphId: null,
      onboardingReviewOpened: false,
      onboardingDeleteNodeDone: false,
    }),
  markReviewReminderShown: (graphId, localDay) =>
    set((state) => ({
      reviewReminderLastShownByGraph: {
        ...state.reviewReminderLastShownByGraph,
        [graphId]: localDay,
      },
    })),

  // Viewports observed in a zero-sized window (embedded WebViews before first
  // layout) are degenerate min-zoom fits — persisting one would keep the graph
  // invisible on every subsequent launch.
  saveViewport: (id, vp) => {
    if (window.innerWidth <= 0 || window.innerHeight <= 0) return
    set((s) => ({ viewports: { ...s.viewports, [id]: vp } }))
  },
})
