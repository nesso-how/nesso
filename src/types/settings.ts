// SPDX-License-Identifier: MIT
import type { Card, State } from 'ts-fsrs'
import type { CategoryPalette } from '@nesso-how/vocab-learning'
import type { ConceptNodeData } from '@nesso-how/vocab-learning'
import type { CurveStyle, EdgeEncoding, GraphDisplaySettings } from '@nesso-how/graph'

export type Language = 'en' | 'it'

export interface NessoSettings {
  dark: boolean
  language: Language
  edgeEncoding: EdgeEncoding
  showHeatmap: boolean
  curveStyle: CurveStyle
  autoCurveFlip: boolean
  categoryPalette: CategoryPalette
  aiBaseUrl: string
  aiModel: string
  aiApiKey: string
  reviewEnabled: boolean
  fsrsRetention: number
  maximumInterval: number
  inspectorMemoryOpen: boolean
  inspectorExamplesOpen: boolean
  inspectorRelationsOpen: boolean
  /** Desktop: absolute paths of folders the user has explicitly opened, most-recent first. */
  knownProjects: string[]
  /** Desktop: absolute path of the active project folder; null until resolved at startup. */
  activeProjectPath: string | null
  /** Opt-in: anonymous crash reports (Sentry) and usage events (PostHog). Default false. */
  telemetry: boolean
}

export function nodeToCard(data: ConceptNodeData): Card {
  return {
    due: new Date(data.due || Date.now()),
    stability: data.stability,
    difficulty: data.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: data.learningSteps ?? 0,
    reps: data.reps,
    lapses: data.lapses,
    state: data.fsrsState as State,
    last_review: data.lastReview ? new Date(data.lastReview) : undefined,
  }
}

export function defaultGraphDisplay(
  settings?: Pick<NessoSettings, 'edgeEncoding' | 'showHeatmap' | 'curveStyle' | 'autoCurveFlip'>,
): GraphDisplaySettings {
  return {
    edgeEncoding: settings?.edgeEncoding ?? 'full',
    showHeatmap: settings?.showHeatmap ?? true,
    curveStyle: settings?.curveStyle ?? 'arc',
    autoCurveFlip: settings?.autoCurveFlip !== false,
  }
}

export function mergeGraphDisplay(
  stored: Partial<GraphDisplaySettings> | undefined,
  settings: NessoSettings,
): GraphDisplaySettings {
  const base = defaultGraphDisplay(settings)
  if (!stored) return base
  return {
    edgeEncoding: stored.edgeEncoding ?? base.edgeEncoding,
    showHeatmap: stored.showHeatmap ?? base.showHeatmap,
    curveStyle: stored.curveStyle ?? base.curveStyle,
    autoCurveFlip: stored.autoCurveFlip !== undefined ? stored.autoCurveFlip : base.autoCurveFlip,
  }
}
