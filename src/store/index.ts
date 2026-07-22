// SPDX-License-Identifier: MIT
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ZUSTAND_PERSIST_KEY } from '@/data/storageKeys'
import { createGraphEditingSlice } from './slices/graph-editing'
import { createSettingsSlice } from './slices/settings'
import { createUISlice } from './slices/ui'
import { createGraphManagementSlice } from './slices/graph-management'
import { createDesktopSyncSlice } from './slices/desktop-sync'
import type { GraphState } from './state'

export type { GraphState } from './state'

export const useGraphStore = create<GraphState>()(
  persist(
    (...args) => ({
      ...createGraphEditingSlice(...args),
      ...createSettingsSlice(...args),
      ...createUISlice(...args),
      ...createGraphManagementSlice(...args),
      ...createDesktopSyncSlice(...args),
    }),
    {
      name: ZUSTAND_PERSIST_KEY,
      partialize: (s) => ({
        settings: s.settings,
        mentorPanelExpanded: s.mentorPanelExpanded,
        sidebarCollapsed: s.sidebarCollapsed,
        sidebarDisplayOpen: s.sidebarDisplayOpen,
        inspectorCollapsed: s.inspectorCollapsed,
        currentGraphId: s.currentGraphId,
        graphList: s.graphList,
        viewports: s.viewports,
        onboardingStep: s.onboardingStep,
        onboardingPhase: s.onboardingPhase,
        onboardingTourGraphId: s.onboardingTourGraphId,
        onboardingReviewOpened: s.onboardingReviewOpened,
        onboardingDeleteNodeDone: s.onboardingDeleteNodeDone,
        reviewReminderLastShownByGraph: s.reviewReminderLastShownByGraph,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<GraphState> | undefined
        if (!p) return current
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...p.settings },
        }
      },
    },
  ),
)

export const selectedNodeSelector = (s: GraphState) => {
  if (s.selected?.kind !== 'node') return null
  return s.nodes.find((n) => n.id === s.selected!.id) ?? null
}

export const selectedEdgeSelector = (s: GraphState) => {
  if (s.selected?.kind !== 'edge') return null
  return s.edges.find((e) => e.id === s.selected!.id) ?? null
}

export const graphDisplaySelector = (s: GraphState) => s.graphDisplay
