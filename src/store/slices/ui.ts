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

  saveViewport: (id, vp) => set((s) => ({ viewports: { ...s.viewports, [id]: vp } })),
})
