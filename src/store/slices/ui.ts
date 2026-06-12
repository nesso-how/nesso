// SPDX-License-Identifier: MIT
import type { StateCreator } from 'zustand'
import type { Viewport, Toast, ConfirmRequest } from '../types'
import type { GraphState } from '../state'

const MAX_TOASTS = 4

export interface UISlice {
  mentorPanelExpanded: boolean
  sidebarCollapsed: boolean
  sidebarDisplayOpen: boolean
  sidebarStatsOpen: boolean
  viewports: Record<string, Viewport>
  toasts: Toast[]
  confirmRequest: ConfirmRequest | null
  setMentorPanelExpanded: (expanded: boolean) => void
  setSidebarCollapsed: (v: boolean) => void
  setSidebarDisplayOpen: (v: boolean) => void
  setSidebarStatsOpen: (v: boolean) => void
  saveViewport: (id: string, vp: Viewport) => void
  pushToast: (toast: Toast) => void
  dismissToast: (id: string) => void
  openConfirm: (request: ConfirmRequest) => void
  closeConfirm: () => void
}

export const createUISlice: StateCreator<GraphState, [], [], UISlice> = (set) => ({
  mentorPanelExpanded: false,
  sidebarCollapsed: false,
  sidebarDisplayOpen: true,
  sidebarStatsOpen: true,
  viewports: {},
  toasts: [],
  confirmRequest: null,

  setMentorPanelExpanded: (expanded) => set({ mentorPanelExpanded: expanded }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setSidebarDisplayOpen: (v) => set({ sidebarDisplayOpen: v }),
  setSidebarStatsOpen: (v) => set({ sidebarStatsOpen: v }),

  pushToast: (toast) =>
    set((s) => ({
      toasts: [...s.toasts.filter((t) => t.id !== toast.id), toast].slice(-MAX_TOASTS),
    })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  openConfirm: (request) => set({ confirmRequest: request }),
  closeConfirm: () => set({ confirmRequest: null }),

  // Viewports observed in a zero-sized window (embedded WebViews before first
  // layout) are degenerate min-zoom fits — persisting one would keep the graph
  // invisible on every subsequent launch.
  saveViewport: (id, vp) => {
    if (window.innerWidth <= 0 || window.innerHeight <= 0) return
    set((s) => ({ viewports: { ...s.viewports, [id]: vp } }))
  },
})
