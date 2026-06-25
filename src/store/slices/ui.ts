// SPDX-License-Identifier: MIT
import type { StateCreator } from 'zustand'
import type { Viewport, Toast, ConfirmRequest } from '../types'
import type { GraphState } from '../state'

const MAX_TOASTS = 4

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
}

export const createUISlice: StateCreator<GraphState, [], [], UISlice> = (set) => ({
  mentorPanelExpanded: false,
  sidebarCollapsed: false,
  sidebarDisplayOpen: true,
  inspectorCollapsed: false,
  viewports: {},
  toasts: [],
  confirmRequest: null,
  onboardingStep: null,

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

  // Viewports observed in a zero-sized window (embedded WebViews before first
  // layout) are degenerate min-zoom fits — persisting one would keep the graph
  // invisible on every subsequent launch.
  saveViewport: (id, vp) => {
    if (window.innerWidth <= 0 || window.innerHeight <= 0) return
    set((s) => ({ viewports: { ...s.viewports, [id]: vp } }))
  },
})
