// SPDX-License-Identifier: MIT
import type { Card, State } from 'ts-fsrs'

export interface ConceptElaboration {
  definition: string
  examples: string
  notes: string
  imageUrl?: string // Wikimedia thumbnail URL (~200px)
  imageTitle?: string // File title, e.g. "File:Foo.jpg"
  imageDescriptionUrl?: string // Link to the Commons page for attribution
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

export type EdgeCategory =
  | 'taxonomic'
  | 'structural'
  | 'causal'
  | 'dependency'
  | 'temporal'
  | 'opposition'

export type EdgeTypeName =
  | 'is-a' | 'instance-of' | 'subtype-of'
  | 'part-of' | 'made-of' | 'contains'
  | 'causes' | 'produces' | 'enables' | 'prevents' | 'triggers'
  | 'requires' | 'uses'
  | 'precedes' | 'occurs-in'
  | 'contrasts-with' | 'opposite-of'

export interface EdgeTypeDef {
  cat: EdgeCategory
  line: 'solid' | 'dashed' | 'dotted' | 'double' | 'wavy'
  glyph: GlyphKind
  symmetric: boolean
  label: string
}

export type GlyphKind =
  | 'triangle-up' | 'circle-dot' | 'diamond' | 'diamond-open' | 'hash'
  | 'arrow-right' | 'asterisk' | 'key' | 'block' | 'spark'
  | 'anchor' | 'tool' | 'chevron-r' | 'ring' | 'tilde' | 'x'

export type EdgeEncoding = 'full' | 'category' | 'minimal'
export type CurveStyle = 'arc' | 'straight'
export type CategoryPalette = 'default' | 'vivid' | 'muted' | 'monoCat'

export type Language = 'en' | 'it'

export interface NessoSettings {
  dark: boolean
  accent: string
  language: Language
  edgeEncoding: EdgeEncoding
  showLabels: boolean
  showConfidence: boolean
  showHeatmap: boolean
  curveStyle: CurveStyle
  categoryPalette: CategoryPalette
  aiMode: 'remote' | 'local'
  /** OpenAI-compatible API base, e.g. http://localhost:11434/v1 (Ollama) or a cloud vendor URL */
  aiBaseUrl: string
  aiModel: string
  /** Stored in localStorage (persisted settings). Empty = no Authorization header. */
  aiApiKey: string
  fsrsRetention: number // 0.70–0.97
  /** FSRS maximum interval in days; caps how far into the future a card can be scheduled */
  maximumInterval: number
}
