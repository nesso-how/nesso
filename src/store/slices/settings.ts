// SPDX-License-Identifier: MIT
import type { StateCreator } from 'zustand'
import type { NessoSettings, GraphDisplaySettings } from '@/types/graph'
import { defaultGraphDisplay } from '@/types/graph'
import { bakeCurveFlipFromPositions, pushHistory } from './graph-editing'
import type { GraphState } from '../state'

export interface SettingsSlice {
  settings: NessoSettings
  graphDisplay: GraphDisplaySettings
  setSetting: <K extends keyof NessoSettings>(key: K, value: NessoSettings[K]) => void
  setGraphDisplay: <K extends keyof GraphDisplaySettings>(
    key: K,
    value: GraphDisplaySettings[K],
  ) => void
}

export const createSettingsSlice: StateCreator<GraphState, [], [], SettingsSlice> = (set) => ({
  settings: {
    dark: false,
    language: 'en' as const,
    edgeEncoding: 'full',
    showHeatmap: false,
    curveStyle: 'arc',
    autoCurveFlip: true,
    categoryPalette: 'default',
    aiBaseUrl: 'http://localhost:11434/v1',
    aiModel: 'gemma3:4b',
    aiApiKey: '',
    reviewEnabled: true,
    fsrsRetention: 0.9,
    maximumInterval: 365,
    inspectorMemoryOpen: true,
    inspectorExamplesOpen: true,
    inspectorRelationsOpen: true,
    knownProjects: [],
    activeProjectPath: null,
    telemetry: false,
    onboardingCompleted: false,
    telemetryPromptShown: false,
  },
  graphDisplay: defaultGraphDisplay(),

  setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),

  setGraphDisplay: (key, value) =>
    set((s) => {
      const graphDisplay = { ...s.graphDisplay, [key]: value }
      if (key === 'autoCurveFlip' && value === false && s.graphDisplay.autoCurveFlip) {
        return {
          ...pushHistory(s),
          graphDisplay,
          edges: bakeCurveFlipFromPositions(s.edges, s.nodes),
        }
      }
      return { graphDisplay }
    }),
})
