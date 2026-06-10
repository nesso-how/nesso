// SPDX-License-Identifier: MIT
import type { StateCreator } from 'zustand'
import type { Viewport } from '../types'
import type { GraphState } from '../state'

export interface UISlice {
  mentorPanelExpanded: boolean
  sidebarCollapsed: boolean
  sidebarDisplayOpen: boolean
  sidebarStatsOpen: boolean
  viewports: Record<string, Viewport>
  setMentorPanelExpanded: (expanded: boolean) => void
  setSidebarCollapsed: (v: boolean) => void
  setSidebarDisplayOpen: (v: boolean) => void
  setSidebarStatsOpen: (v: boolean) => void
  saveViewport: (id: string, vp: Viewport) => void
}

export const createUISlice: StateCreator<GraphState, [], [], UISlice> = (set) => ({
  mentorPanelExpanded: false,
  sidebarCollapsed: false,
  sidebarDisplayOpen: true,
  sidebarStatsOpen: true,
  viewports: {},

  setMentorPanelExpanded: (expanded) => set({ mentorPanelExpanded: expanded }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setSidebarDisplayOpen: (v) => set({ sidebarDisplayOpen: v }),
  setSidebarStatsOpen: (v) => set({ sidebarStatsOpen: v }),

  // Viewports observed in a zero-sized window (embedded WebViews before first
  // layout) are degenerate min-zoom fits — persisting one would keep the graph
  // invisible on every subsequent launch.
  saveViewport: (id, vp) => {
    if (window.innerWidth <= 0 || window.innerHeight <= 0) return
    set((s) => ({ viewports: { ...s.viewports, [id]: vp } }))
  },
})
