// SPDX-License-Identifier: MIT

/** OKG vocabulary identity — version bumps only on normative vocabulary changes, not npm releases. */
export const VOCABULARY = {
  id: '@nesso-how/vocab-learning',
  name: 'Nesso Learning Vocabulary',
  domain: 'learning',
  version: '0.1.0',
} as const

/** Private dynamic node parameters declared by the Nesso Learning Vocabulary. */
export interface LearningNodeParams extends Record<string, unknown> {
  stability: number
  difficulty: number
  reps: number
  lapses: number
  /** ts-fsrs State: 0=New 1=Learning 2=Review 3=Relearning */
  fsrsState: number
  /** Unix ms; due when <= now (0 = new / immediate). */
  due: number
  /** Unix ms; 0 = never reviewed. */
  lastReview: number
  /** 0=unrated, 1=Again 2=Hard 3=Good 4=Easy (matches ts-fsrs Rating). */
  lastRating: number
  /** FSRS learning-step index; optional for records saved before it existed. */
  learningSteps?: number
}

/** Fresh private params for a new or shared-import concept (no personal review history). */
export function defaultConceptReviewFields(): LearningNodeParams {
  return {
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    fsrsState: 0,
    due: 0,
    lastReview: 0,
    lastRating: 0,
    learningSteps: 0,
  }
}

export type EdgeCategory =
  | 'taxonomic'
  | 'structural'
  | 'causal'
  | 'dependency'
  | 'temporal'
  | 'opposition'
  | 'similarity'
  | 'epistemic'

export type EdgeTypeName =
  // taxonomic
  | 'subtype-of'
  | 'has-subtype'
  | 'instance-of'
  | 'has-instance'
  // structural
  | 'part-of'
  | 'contains'
  | 'made-of'
  | 'composes'
  // causal
  | 'causes'
  | 'caused-by'
  | 'produces'
  | 'produced-by'
  | 'enables'
  | 'enabled-by'
  | 'prevents'
  | 'prevented-by'
  | 'triggers'
  | 'triggered-by'
  | 'inhibits'
  | 'inhibited-by'
  | 'disables'
  | 'disabled-by'
  | 'consumes'
  | 'consumed-by'
  | 'delays'
  | 'delayed-by'
  // dependency
  | 'requires'
  | 'required-by'
  | 'uses'
  | 'used-by'
  | 'used-for'
  | 'purpose-of'
  // temporal
  | 'precedes'
  | 'follows'
  | 'occurs-in'
  | 'has-occurrence'
  | 'during'
  | 'spans'
  | 'overlaps-with'
  | 'derives-from'
  | 'gives-rise-to'
  // opposition
  | 'contrasts-with'
  | 'opposite-of'
  // similarity
  | 'similar-to'
  | 'analogous-to'
  // epistemic
  | 'supports'
  | 'supported-by'
  | 'contradicts'
  | 'explains'
  | 'explained-by'
  | 'defines'
  | 'defined-by'

export type GlyphKind =
  | 'triangle-up'
  | 'circle-dot'
  | 'diamond'
  | 'diamond-open'
  | 'hash'
  | 'arrow-right'
  | 'asterisk'
  | 'key'
  | 'block'
  | 'spark'
  | 'anchor'
  | 'tool'
  | 'chevron-r'
  | 'ring'
  | 'tilde'
  | 'x'
  | 'minus'
  | 'flag'
  | 'approx'
  | 'arrows-lr'
  | 'check'
  | 'slash'
  | 'bulb'
  | 'equals'
  | 'lock'
  | 'flame'
  | 'hourglass'
  | 'brackets'
  | 'overlap'
  | 'branch'

/** Transitivity of a relation: `Y` strict, `N` none, `weak` with decay (algorithms may discount weight per step). */
export type Transitivity = 'Y' | 'N' | 'weak'

/** Polarity in signed-network terms: `+1` positive effect, `-1` antagonistic, `0` neutral/structural. */
export type Polarity = -1 | 0 | 1

/** Expected mapping cardinality. `N-N` means no a-priori constraint. */
export type Cardinality = '1-1' | '1-N' | 'N-1' | 'N-N'

export interface EdgeTypeDef {
  cat: EdgeCategory
  label: string
  // visual encoding
  line: 'solid' | 'dashed' | 'dotted' | 'double' | 'wavy'
  glyph: GlyphKind
  // semantic coefficients
  transitive: Transitivity
  /** Canonical inverse in the set; `'self'` for symmetric types. */
  inverse: EdgeTypeName | 'self'
  /** Per-type semantic weight in 0..1; intensity, not per-edge confidence. */
  strength: number
  polarity: Polarity
  cardinality: Cardinality
}

/** Canonical category labels and prompts. */
export const RELATION_CATEGORY_META: Record<EdgeCategory, { label: string; subtitle: string }> = {
  taxonomic: { label: 'Taxonomic', subtitle: 'What kind of thing?' },
  structural: { label: 'Structural', subtitle: "What's it made of?" },
  causal: { label: 'Causal', subtitle: 'What does it do?' },
  dependency: { label: 'Dependency', subtitle: 'What does it need?' },
  temporal: { label: 'Temporal', subtitle: 'When? Where?' },
  opposition: { label: 'Opposition', subtitle: 'What does it contrast with?' },
  similarity: { label: 'Similarity', subtitle: 'What is it like?' },
  epistemic: { label: 'Epistemic', subtitle: 'How do we know?' },
}

export const RELATION_TYPES: Record<EdgeTypeName, EdgeTypeDef> = {
  // taxonomic ────────────────────────────────────────────────────────────
  'subtype-of': {
    cat: 'taxonomic',
    label: 'subtype of',
    line: 'double',
    glyph: 'triangle-up',
    transitive: 'Y',
    inverse: 'has-subtype',
    strength: 0.9,
    polarity: 0,
    cardinality: 'N-1',
  },
  'has-subtype': {
    cat: 'taxonomic',
    label: 'has subtype',
    line: 'double',
    glyph: 'triangle-up',
    transitive: 'Y',
    inverse: 'subtype-of',
    strength: 0.9,
    polarity: 0,
    cardinality: '1-N',
  },
  'instance-of': {
    cat: 'taxonomic',
    label: 'instance of',
    line: 'solid',
    glyph: 'circle-dot',
    transitive: 'N',
    inverse: 'has-instance',
    strength: 0.95,
    polarity: 0,
    cardinality: 'N-1',
  },
  'has-instance': {
    cat: 'taxonomic',
    label: 'has instance',
    line: 'solid',
    glyph: 'circle-dot',
    transitive: 'N',
    inverse: 'instance-of',
    strength: 0.95,
    polarity: 0,
    cardinality: '1-N',
  },

  // structural ───────────────────────────────────────────────────────────
  'part-of': {
    cat: 'structural',
    label: 'part of',
    line: 'solid',
    glyph: 'diamond',
    transitive: 'Y',
    inverse: 'contains',
    strength: 0.85,
    polarity: 0,
    cardinality: 'N-1',
  },
  contains: {
    cat: 'structural',
    label: 'contains',
    line: 'solid',
    glyph: 'diamond-open',
    transitive: 'Y',
    inverse: 'part-of',
    strength: 0.85,
    polarity: 0,
    cardinality: '1-N',
  },
  'made-of': {
    cat: 'structural',
    label: 'made of',
    line: 'dashed',
    glyph: 'hash',
    transitive: 'weak',
    inverse: 'composes',
    strength: 0.75,
    polarity: 0,
    cardinality: 'N-N',
  },
  composes: {
    cat: 'structural',
    label: 'composes',
    line: 'dashed',
    glyph: 'hash',
    transitive: 'weak',
    inverse: 'made-of',
    strength: 0.75,
    polarity: 0,
    cardinality: 'N-N',
  },

  // causal ───────────────────────────────────────────────────────────────
  causes: {
    cat: 'causal',
    label: 'causes',
    line: 'solid',
    glyph: 'arrow-right',
    transitive: 'N',
    inverse: 'caused-by',
    strength: 0.85,
    polarity: 1,
    cardinality: 'N-N',
  },
  'caused-by': {
    cat: 'causal',
    label: 'caused by',
    line: 'solid',
    glyph: 'arrow-right',
    transitive: 'N',
    inverse: 'causes',
    strength: 0.85,
    polarity: 1,
    cardinality: 'N-N',
  },
  produces: {
    cat: 'causal',
    label: 'produces',
    line: 'solid',
    glyph: 'asterisk',
    transitive: 'N',
    inverse: 'produced-by',
    strength: 0.7,
    polarity: 1,
    cardinality: 'N-N',
  },
  'produced-by': {
    cat: 'causal',
    label: 'produced by',
    line: 'solid',
    glyph: 'asterisk',
    transitive: 'N',
    inverse: 'produces',
    strength: 0.7,
    polarity: 1,
    cardinality: 'N-N',
  },
  enables: {
    cat: 'causal',
    label: 'enables',
    line: 'dotted',
    glyph: 'key',
    transitive: 'weak',
    inverse: 'enabled-by',
    strength: 0.6,
    polarity: 1,
    cardinality: 'N-N',
  },
  'enabled-by': {
    cat: 'causal',
    label: 'enabled by',
    line: 'dotted',
    glyph: 'key',
    transitive: 'weak',
    inverse: 'enables',
    strength: 0.6,
    polarity: 1,
    cardinality: 'N-N',
  },
  prevents: {
    cat: 'causal',
    label: 'prevents',
    line: 'dotted',
    glyph: 'block',
    transitive: 'N',
    inverse: 'prevented-by',
    strength: 0.85,
    polarity: -1,
    cardinality: 'N-N',
  },
  'prevented-by': {
    cat: 'causal',
    label: 'prevented by',
    line: 'dotted',
    glyph: 'block',
    transitive: 'N',
    inverse: 'prevents',
    strength: 0.85,
    polarity: -1,
    cardinality: 'N-N',
  },
  triggers: {
    cat: 'causal',
    label: 'triggers',
    line: 'solid',
    glyph: 'spark',
    transitive: 'N',
    inverse: 'triggered-by',
    strength: 0.7,
    polarity: 1,
    cardinality: 'N-N',
  },
  'triggered-by': {
    cat: 'causal',
    label: 'triggered by',
    line: 'solid',
    glyph: 'spark',
    transitive: 'N',
    inverse: 'triggers',
    strength: 0.7,
    polarity: 1,
    cardinality: 'N-N',
  },
  inhibits: {
    cat: 'causal',
    label: 'inhibits',
    line: 'dotted',
    glyph: 'minus',
    transitive: 'N',
    inverse: 'inhibited-by',
    strength: 0.55,
    polarity: -1,
    cardinality: 'N-N',
  },
  'inhibited-by': {
    cat: 'causal',
    label: 'inhibited by',
    line: 'dotted',
    glyph: 'minus',
    transitive: 'N',
    inverse: 'inhibits',
    strength: 0.55,
    polarity: -1,
    cardinality: 'N-N',
  },
  disables: {
    cat: 'causal',
    label: 'disables',
    line: 'dotted',
    glyph: 'lock',
    transitive: 'weak',
    inverse: 'disabled-by',
    strength: 0.6,
    polarity: -1,
    cardinality: 'N-N',
  },
  'disabled-by': {
    cat: 'causal',
    label: 'disabled by',
    line: 'dotted',
    glyph: 'lock',
    transitive: 'weak',
    inverse: 'disables',
    strength: 0.6,
    polarity: -1,
    cardinality: 'N-N',
  },
  consumes: {
    cat: 'causal',
    label: 'consumes',
    line: 'solid',
    glyph: 'flame',
    transitive: 'N',
    inverse: 'consumed-by',
    strength: 0.65,
    polarity: -1,
    cardinality: 'N-N',
  },
  'consumed-by': {
    cat: 'causal',
    label: 'consumed by',
    line: 'solid',
    glyph: 'flame',
    transitive: 'N',
    inverse: 'consumes',
    strength: 0.65,
    polarity: -1,
    cardinality: 'N-N',
  },
  delays: {
    cat: 'causal',
    label: 'delays',
    line: 'dotted',
    glyph: 'hourglass',
    transitive: 'weak',
    inverse: 'delayed-by',
    strength: 0.55,
    polarity: -1,
    cardinality: 'N-N',
  },
  'delayed-by': {
    cat: 'causal',
    label: 'delayed by',
    line: 'dotted',
    glyph: 'hourglass',
    transitive: 'weak',
    inverse: 'delays',
    strength: 0.55,
    polarity: -1,
    cardinality: 'N-N',
  },

  // dependency ───────────────────────────────────────────────────────────
  requires: {
    cat: 'dependency',
    label: 'requires',
    line: 'solid',
    glyph: 'anchor',
    transitive: 'Y',
    inverse: 'required-by',
    strength: 0.85,
    polarity: 0,
    cardinality: 'N-N',
  },
  'required-by': {
    cat: 'dependency',
    label: 'required by',
    line: 'solid',
    glyph: 'anchor',
    transitive: 'Y',
    inverse: 'requires',
    strength: 0.85,
    polarity: 0,
    cardinality: 'N-N',
  },
  uses: {
    cat: 'dependency',
    label: 'uses',
    line: 'dashed',
    glyph: 'tool',
    transitive: 'weak',
    inverse: 'used-by',
    strength: 0.5,
    polarity: 0,
    cardinality: 'N-N',
  },
  'used-by': {
    cat: 'dependency',
    label: 'used by',
    line: 'dashed',
    glyph: 'tool',
    transitive: 'weak',
    inverse: 'uses',
    strength: 0.5,
    polarity: 0,
    cardinality: 'N-N',
  },
  'used-for': {
    cat: 'dependency',
    label: 'used for',
    line: 'dashed',
    glyph: 'flag',
    transitive: 'N',
    inverse: 'purpose-of',
    strength: 0.55,
    polarity: 1,
    cardinality: 'N-N',
  },
  'purpose-of': {
    cat: 'dependency',
    label: 'purpose of',
    line: 'dashed',
    glyph: 'flag',
    transitive: 'N',
    inverse: 'used-for',
    strength: 0.55,
    polarity: 1,
    cardinality: 'N-N',
  },

  // temporal ─────────────────────────────────────────────────────────────
  precedes: {
    cat: 'temporal',
    label: 'precedes',
    line: 'solid',
    glyph: 'chevron-r',
    transitive: 'Y',
    inverse: 'follows',
    strength: 0.5,
    polarity: 0,
    cardinality: 'N-N',
  },
  follows: {
    cat: 'temporal',
    label: 'follows',
    line: 'solid',
    glyph: 'chevron-r',
    transitive: 'Y',
    inverse: 'precedes',
    strength: 0.5,
    polarity: 0,
    cardinality: 'N-N',
  },
  'occurs-in': {
    cat: 'temporal',
    label: 'occurs in',
    line: 'dotted',
    glyph: 'ring',
    transitive: 'Y',
    inverse: 'has-occurrence',
    strength: 0.4,
    polarity: 0,
    cardinality: 'N-1',
  },
  'has-occurrence': {
    cat: 'temporal',
    label: 'has occurrence',
    line: 'dotted',
    glyph: 'ring',
    transitive: 'Y',
    inverse: 'occurs-in',
    strength: 0.4,
    polarity: 0,
    cardinality: '1-N',
  },
  during: {
    cat: 'temporal',
    label: 'during',
    line: 'solid',
    glyph: 'brackets',
    transitive: 'Y',
    inverse: 'spans',
    strength: 0.55,
    polarity: 0,
    cardinality: 'N-1',
  },
  spans: {
    cat: 'temporal',
    label: 'spans',
    line: 'solid',
    glyph: 'brackets',
    transitive: 'Y',
    inverse: 'during',
    strength: 0.55,
    polarity: 0,
    cardinality: '1-N',
  },
  'overlaps-with': {
    cat: 'temporal',
    label: 'overlaps with',
    line: 'dashed',
    glyph: 'overlap',
    transitive: 'N',
    inverse: 'self',
    strength: 0.45,
    polarity: 0,
    cardinality: 'N-N',
  },
  'derives-from': {
    cat: 'temporal',
    label: 'derives from',
    line: 'solid',
    glyph: 'branch',
    transitive: 'Y',
    inverse: 'gives-rise-to',
    strength: 0.7,
    polarity: 0,
    cardinality: 'N-1',
  },
  'gives-rise-to': {
    cat: 'temporal',
    label: 'gives rise to',
    line: 'solid',
    glyph: 'branch',
    transitive: 'Y',
    inverse: 'derives-from',
    strength: 0.7,
    polarity: 0,
    cardinality: '1-N',
  },

  // opposition ───────────────────────────────────────────────────────────
  'contrasts-with': {
    cat: 'opposition',
    label: 'contrasts with',
    line: 'wavy',
    glyph: 'tilde',
    transitive: 'N',
    inverse: 'self',
    strength: 0.5,
    polarity: -1,
    cardinality: 'N-N',
  },
  'opposite-of': {
    cat: 'opposition',
    label: 'opposite of',
    line: 'double',
    glyph: 'x',
    transitive: 'N',
    inverse: 'self',
    strength: 0.8,
    polarity: -1,
    cardinality: '1-1',
  },

  // similarity ───────────────────────────────────────────────────────────
  'similar-to': {
    cat: 'similarity',
    label: 'similar to',
    line: 'dashed',
    glyph: 'approx',
    transitive: 'weak',
    inverse: 'self',
    strength: 0.4,
    polarity: 1,
    cardinality: 'N-N',
  },
  'analogous-to': {
    cat: 'similarity',
    label: 'analogous to',
    line: 'dotted',
    glyph: 'arrows-lr',
    transitive: 'N',
    inverse: 'self',
    strength: 0.3,
    polarity: 1,
    cardinality: 'N-N',
  },

  // epistemic ────────────────────────────────────────────────────────────
  supports: {
    cat: 'epistemic',
    label: 'supports',
    line: 'dotted',
    glyph: 'check',
    transitive: 'weak',
    inverse: 'supported-by',
    strength: 0.7,
    polarity: 1,
    cardinality: 'N-N',
  },
  'supported-by': {
    cat: 'epistemic',
    label: 'supported by',
    line: 'dotted',
    glyph: 'check',
    transitive: 'weak',
    inverse: 'supports',
    strength: 0.7,
    polarity: 1,
    cardinality: 'N-N',
  },
  contradicts: {
    cat: 'epistemic',
    label: 'contradicts',
    line: 'dotted',
    glyph: 'slash',
    transitive: 'N',
    inverse: 'self',
    strength: 0.75,
    polarity: -1,
    cardinality: 'N-N',
  },
  explains: {
    cat: 'epistemic',
    label: 'explains',
    line: 'solid',
    glyph: 'bulb',
    transitive: 'weak',
    inverse: 'explained-by',
    strength: 0.8,
    polarity: 0,
    cardinality: 'N-N',
  },
  'explained-by': {
    cat: 'epistemic',
    label: 'explained by',
    line: 'solid',
    glyph: 'bulb',
    transitive: 'weak',
    inverse: 'explains',
    strength: 0.8,
    polarity: 0,
    cardinality: 'N-N',
  },
  defines: {
    cat: 'epistemic',
    label: 'defines',
    line: 'solid',
    glyph: 'equals',
    transitive: 'N',
    inverse: 'defined-by',
    strength: 0.9,
    polarity: 0,
    cardinality: '1-1',
  },
  'defined-by': {
    cat: 'epistemic',
    label: 'defined by',
    line: 'solid',
    glyph: 'equals',
    transitive: 'N',
    inverse: 'defines',
    strength: 0.9,
    polarity: 0,
    cardinality: '1-1',
  },
}

export const RELATION_TYPE_VALUES = Object.keys(RELATION_TYPES) as EdgeTypeName[]

/** Forward member of each inverse pair (first in `RELATION_TYPE_VALUES`); all symmetric types. */
export function isPrimaryRelationType(id: EdgeTypeName): boolean {
  const def = RELATION_TYPES[id]
  if (def.inverse === 'self') return true
  return RELATION_TYPE_VALUES.indexOf(id) < RELATION_TYPE_VALUES.indexOf(def.inverse)
}

// ─── Visual encoding ──────────────────────────────────────────────────────────

export type CategoryPalette = 'default' | 'vivid' | 'muted' | 'monoCat'

/** Per-category hex colors for each named palette. */
export const PALETTES: Record<CategoryPalette, Record<EdgeCategory, string>> = {
  default: {
    taxonomic: '#2f5d8e',
    structural: '#6b4a8a',
    causal: '#b14a2e',
    dependency: '#8a6a1a',
    temporal: '#2d6a55',
    opposition: '#8a2e4a',
    similarity: '#2a6878',
    epistemic: '#3a4a8a',
  },
  vivid: {
    taxonomic: '#0066cc',
    structural: '#9333ea',
    causal: '#dc2626',
    dependency: '#ea580c',
    temporal: '#0d9488',
    opposition: '#be185d',
    similarity: '#0891b2',
    epistemic: '#4338ca',
  },
  muted: {
    taxonomic: '#5a7896',
    structural: '#806894',
    causal: '#a86a52',
    dependency: '#9a8556',
    temporal: '#5a8276',
    opposition: '#9a586c',
    similarity: '#5a8090',
    epistemic: '#5a6896',
  },
  monoCat: {
    taxonomic: '#3a3a3a',
    structural: '#3a3a3a',
    causal: '#3a3a3a',
    dependency: '#3a3a3a',
    temporal: '#3a3a3a',
    opposition: '#3a3a3a',
    similarity: '#3a3a3a',
    epistemic: '#3a3a3a',
  },
}

/**
 * Raw SVG inner content for each glyph kind, on a 14×14 viewBox.
 * Uses `currentColor` for stroke/fill — set CSS `color` on the parent to tint.
 * Default stroke attrs: fill=none, stroke=currentColor, stroke-width=1.4,
 * stroke-linecap=round, stroke-linejoin=round.
 */
export const GLYPH_PATHS: Record<GlyphKind, string> = {
  'triangle-up': '<polygon points="7,3 11,10 3,10" fill="currentColor" stroke="none"/>',
  'circle-dot':
    '<circle cx="7" cy="7" r="5"/><circle cx="7" cy="7" r="1.6" fill="currentColor" stroke="none"/>',
  diamond: '<polygon points="7,2 12,7 7,12 2,7" fill="currentColor" stroke="none"/>',
  'diamond-open': '<polygon points="7,2 12,7 7,12 2,7"/>',
  hash: '<path d="M5 2v10M9 2v10M2 5h10M2 9h10"/>',
  'arrow-right': '<path d="M2 7h10M8 3l4 4-4 4"/>',
  asterisk: '<path d="M7 2v10M3 4l8 6M3 10l8-6"/>',
  key: '<circle cx="5" cy="7" r="2.4"/><path d="M7.4 7H12M10 7v2M11.5 7v1.5"/>',
  block: '<circle cx="7" cy="7" r="4.5"/><path d="M3.7 3.7l6.6 6.6"/>',
  spark: '<path d="M7 2v3M7 9v3M2 7h3M9 7h3M3.5 3.5l2 2M8.5 8.5l2 2M3.5 10.5l2-2M8.5 5.5l2-2"/>',
  anchor: '<circle cx="7" cy="4" r="1.5"/><path d="M7 5.5v6.5M3 9c0 2 2 3 4 3s4-1 4-3M4.5 8.5h5"/>',
  tool: '<path d="M9 2.5L11.5 5l-1.2 1.2-2.5-2.5zM10.3 6.2l-7 7-1.5-1.5 7-7"/>',
  'chevron-r': '<path d="M5 3l4 4-4 4M2 3l4 4-4 4"/>',
  ring: '<circle cx="7" cy="7" r="4.5"/>',
  tilde: '<path d="M2 8 Q4 5 7 7 T12 6"/>',
  x: '<path d="M3 3l8 8M11 3l-8 8" stroke-width="1.8"/>',
  minus: '<path d="M3 7h8" stroke-width="2"/>',
  flag: '<path d="M4 12V2M4 2l7 3.5L4 9"/>',
  approx: '<path d="M2 5 Q4 3 7 5 T12 5"/><path d="M2 9 Q4 7 7 9 T12 9"/>',
  'arrows-lr': '<path d="M2 7h10M3.5 4.5L2 7l1.5 2.5M10.5 4.5L12 7l-1.5 2.5"/>',
  check: '<path d="M2.5 7.5l3 3 6-7"/>',
  slash: '<path d="M11 3l-8 8" stroke-width="1.8"/>',
  bulb: '<path d="M7 2a3.2 3.2 0 0 0-2 5.7c.4.4.7.9.7 1.5v.3h2.6v-.3c0-.6.3-1.1.7-1.5A3.2 3.2 0 0 0 7 2zM5.7 10.5h2.6M6.2 12h1.6"/>',
  equals: '<path d="M3 5.5h8M3 8.5h8" stroke-width="1.8"/>',
  lock: '<rect x="3.5" y="6.5" width="7" height="5.5" rx="0.8"/><path d="M5 6.5V4.5a2 2 0 0 1 4 0v2"/>',
  flame:
    '<path d="M7 2c-1 2.2-3 3.4-3 6a3 3 0 0 0 6 0c0-1.2-.6-2-1.4-2.6.2 1.2-.4 2.2-1.4 2C7.4 5.6 7.8 4 7 2z"/>',
  hourglass: '<path d="M3.5 2.5h7M3.5 11.5h7M4 2.5v1.5L7 7l3-3V2.5M4 11.5v-1.5L7 7l3 3v1.5"/>',
  brackets: '<path d="M4 3h-1.5v8H4M10 3h1.5v8H10"/>',
  overlap: '<path d="M2 5.5h7M5 8.5h7" stroke-width="1.8"/>',
  branch: '<path d="M7 2v10M7 7l-3 3M7 7l3 3"/>',
}
