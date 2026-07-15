// SPDX-License-Identifier: MIT
//
// Semantic relation vocabulary: ordered categories, 52 typed relation ids, and
// per-type properties (transitive, inverse, strength, polarity, cardinality)
// plus visual encoding (category colour + glyph). UI labels live in app i18n, not here.

export const RELATION_CATEGORIES = [
  'taxonomic',
  'structural',
  'causal',
  'dependency',
  'temporal',
  'opposition',
  'similarity',
  'epistemic',
] as const

export type RelationCategory = (typeof RELATION_CATEGORIES)[number]

export type RelationTypeName =
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

export interface RelationTypeDef {
  cat: RelationCategory
  label: string
  // visual encoding
  glyph: GlyphKind
  // type properties
  transitive: Transitivity
  /** Canonical inverse in the set; `'self'` for symmetric types. */
  inverse: RelationTypeName | 'self'
  /** Per-type semantic weight in 0..1; intensity, not per-edge confidence. */
  strength: number
  polarity: Polarity
  cardinality: Cardinality
}

export const RELATION_TYPES: Record<RelationTypeName, RelationTypeDef> = {
  // taxonomic ────────────────────────────────────────────────────────────
  'subtype-of': {
    cat: 'taxonomic',
    label: 'subtype of',
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
    glyph: 'equals',
    transitive: 'N',
    inverse: 'defines',
    strength: 0.9,
    polarity: 0,
    cardinality: '1-1',
  },
}

export const RELATION_TYPE_VALUES = Object.keys(RELATION_TYPES) as RelationTypeName[]

/** Forward member of each inverse pair (first in `RELATION_TYPE_VALUES`); all symmetric types. */
export function isPrimaryRelationType(id: RelationTypeName): boolean {
  const def = RELATION_TYPES[id]
  if (def.inverse === 'self') return true
  return RELATION_TYPE_VALUES.indexOf(id) < RELATION_TYPE_VALUES.indexOf(def.inverse)
}
