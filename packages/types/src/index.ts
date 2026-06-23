// SPDX-License-Identifier: MIT
export type {
  EdgeCategory,
  EdgeTypeDef,
  EdgeTypeName,
  GlyphKind,
  CategoryPalette,
  LearningNodeParams,
} from '@nesso-how/vocab-learning'
export { defaultConceptReviewFields, VOCABULARY } from '@nesso-how/vocab-learning'
import type { Card, State } from 'ts-fsrs'
import type { CategoryPalette, EdgeTypeName, LearningNodeParams } from '@nesso-how/vocab-learning'

export interface ConceptElaboration {
  definition: string
  examples: string
  notes: string
  imageUrl?: string
  imageTitle?: string
  imageDescriptionUrl?: string
}

/** Core semantic content plus private dynamic node params from the Nesso Learning Vocabulary. */
export interface ConceptNodeData extends LearningNodeParams {
  text: string
  elaboration?: ConceptElaboration
}

export function nodeToCard(data: ConceptNodeData): Card {
  return {
    due: new Date(data.due || Date.now()),
    stability: data.stability,
    difficulty: data.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    // Restoring the step keeps Learning/Relearning cards from restarting the
    // step ladder on every rating.
    learning_steps: data.learningSteps ?? 0,
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
}
