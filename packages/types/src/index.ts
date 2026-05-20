// SPDX-License-Identifier: MIT
export type { EdgeCategory, EdgeTypeDef, EdgeTypeName, GlyphKind } from '@nesso-how/relation-types'
import type { Card, State } from 'ts-fsrs'
import type { EdgeTypeName } from '@nesso-how/relation-types'

export interface ConceptElaboration {
  definition: string
  examples: string
  notes: string
  imageUrl?: string
  imageTitle?: string
  imageDescriptionUrl?: string
}

export interface ConceptNodeData extends Record<string, unknown> {
  text: string
  stability: number
  difficulty: number
  reps: number
  lapses: number
  fsrsState: number // State: 0=New 1=Learning 2=Review 3=Relearning
  due: number // ms timestamp; 0 = due immediately (new card)
  lastReview: number // ms timestamp; 0 = never reviewed
  lastRating: number // 0=unrated, 1=Again 2=Hard 3=Good 4=Easy
  elaboration?: ConceptElaboration
}

export function nodeToCard(data: ConceptNodeData): Card {
  return {
    due: new Date(data.due || Date.now()),
    stability: data.stability,
    difficulty: data.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: data.reps,
    lapses: data.lapses,
    state: data.fsrsState as State,
    last_review: data.lastReview ? new Date(data.lastReview) : undefined,
  }
}

export type EdgeEncoding = 'full' | 'category' | 'minimal'
export type CurveStyle = 'arc' | 'straight'

export interface NessoEdgeData extends Record<string, unknown> {
  type: EdgeTypeName
  siblingIdx?: number
  curveFlip?: boolean
  curveFlipPinned?: boolean
}

export type CategoryPalette = 'default' | 'vivid' | 'muted' | 'monoCat'

export type Language = 'en' | 'it'

export interface GraphDisplaySettings {
  edgeEncoding: EdgeEncoding
  showHeatmap: boolean
  curveStyle: CurveStyle
  autoCurveFlip: boolean
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

export interface NessoSettings {
  dark: boolean
  accent: string
  language: Language
  edgeEncoding: EdgeEncoding
  showLabels: boolean
  showConfidence: boolean
  showHeatmap: boolean
  curveStyle: CurveStyle
  autoCurveFlip: boolean
  categoryPalette: CategoryPalette
  aiMode: 'remote' | 'local'
  aiBaseUrl: string
  aiModel: string
  aiApiKey: string
  fsrsRetention: number
  maximumInterval: number
  inspectorExamplesOpen: boolean
  inspectorRelationsOpen: boolean
}
