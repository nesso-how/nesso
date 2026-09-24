// SPDX-License-Identifier: MIT
import type { StateCreator } from 'zustand'
import type { NessoSettings, GraphDisplaySettings } from '@/types/graph'
import { defaultGraphDisplay } from '@/types/graph'
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

export const createSettingsSlice: StateCreator<GraphState, [], [], SettingsSlice> = (set) => {
  const settings: NessoSettings = {
    dark: false,
    language: 'en' as const,
    edgeEncoding: 'full',
    showHeatmap: false,
    curveStyle: 'arc',
    categoryPalette: 'default',
    aiBaseUrl: 'http://localhost:11434/v1',
    aiModel: 'qwen3.5:9b',
    aiApiKey: '',
    mentorSystemPrompt: '',
    mentorEnabled: false,
    reviewEnabled: true,
    reviewReminderEnabled: true,
    fsrsRetention: 0.9,
    maximumInterval: 365,
    inspectorMemoryOpen: true,
    inspectorRelationsOpen: true,
    inspectorElaborationOpen: true,
    knownProjects: [],
    activeProjectPath: null,
    telemetry: false,
    onboardingCompleted: false,
    telemetryPromptShown: false,
  }

  return {
    settings,
    graphDisplay: defaultGraphDisplay(settings),

    setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),

    setGraphDisplay: (key, value) =>
      set((s) => ({ graphDisplay: { ...s.graphDisplay, [key]: value } })),
  }
}
