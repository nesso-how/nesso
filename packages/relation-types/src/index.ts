// SPDX-License-Identifier: MIT

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
  | 'subtype-of' | 'has-subtype'
  | 'instance-of' | 'has-instance'
  // structural
  | 'part-of' | 'contains'
  | 'made-of' | 'composes'
  // causal
  | 'causes' | 'caused-by'
  | 'produces' | 'produced-by'
  | 'enables' | 'enabled-by'
  | 'prevents' | 'prevented-by'
  | 'triggers' | 'triggered-by'
  | 'inhibits' | 'inhibited-by'
  | 'disables' | 'disabled-by'
  | 'consumes' | 'consumed-by'
  | 'delays' | 'delayed-by'
  // dependency
  | 'requires' | 'required-by'
  | 'uses' | 'used-by'
  | 'used-for' | 'purpose-of'
  // temporal
  | 'precedes' | 'follows'
  | 'occurs-in' | 'has-occurrence'
  | 'during' | 'spans'
  | 'overlaps-with'
  | 'derives-from' | 'gives-rise-to'
  // opposition (symmetric)
  | 'contrasts-with' | 'opposite-of'
  // similarity (symmetric)
  | 'similar-to' | 'analogous-to'
  // epistemic
  | 'supports' | 'supported-by'
  | 'contradicts'
  | 'explains' | 'explained-by'
  | 'defines' | 'defined-by'

export type GlyphKind =
  | 'triangle-up' | 'circle-dot' | 'diamond' | 'diamond-open' | 'hash'
  | 'arrow-right' | 'asterisk' | 'key' | 'block' | 'spark'
  | 'anchor' | 'tool' | 'chevron-r' | 'ring' | 'tilde' | 'x'
  | 'minus' | 'flag' | 'approx' | 'arrows-lr'
  | 'check' | 'slash' | 'bulb' | 'equals'
  | 'lock' | 'flame' | 'hourglass'
  | 'brackets' | 'overlap' | 'branch'

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
  symmetric: boolean
  transitive: Transitivity
  /** Canonical inverse in the set. For symmetric types, points to self. */
  inverse: EdgeTypeName
  /** Per-type semantic weight in 0..1; intensity, not per-edge confidence. */
  strength: number
  polarity: Polarity
  cardinality: Cardinality
}

/** Canonical category labels and prompts. */
export const RELATION_CATEGORY_META: Record<EdgeCategory, { label: string; subtitle: string }> = {
  taxonomic:  { label: 'Taxonomic',  subtitle: 'What kind of thing?' },
  structural: { label: 'Structural', subtitle: "What's it made of?" },
  causal:     { label: 'Causal',     subtitle: 'What does it do?' },
  dependency: { label: 'Dependency', subtitle: 'What does it need?' },
  temporal:   { label: 'Temporal',   subtitle: 'When? Where?' },
  opposition: { label: 'Opposition', subtitle: 'What does it contrast with?' },
  similarity: { label: 'Similarity', subtitle: 'What is it like?' },
  epistemic:  { label: 'Epistemic',  subtitle: 'How do we know?' },
}

export const RELATION_TYPES: Record<EdgeTypeName, EdgeTypeDef> = {
  // taxonomic ────────────────────────────────────────────────────────────
  'subtype-of': {
    cat: 'taxonomic', label: 'subtype of',
    line: 'double', glyph: 'triangle-up',
    symmetric: false, transitive: 'Y', inverse: 'has-subtype',
    strength: 0.90, polarity: 0, cardinality: 'N-1',
  },
  'has-subtype': {
    cat: 'taxonomic', label: 'has subtype',
    line: 'double', glyph: 'triangle-up',
    symmetric: false, transitive: 'Y', inverse: 'subtype-of',
    strength: 0.90, polarity: 0, cardinality: '1-N',
  },
  'instance-of': {
    cat: 'taxonomic', label: 'instance of',
    line: 'solid', glyph: 'circle-dot',
    symmetric: false, transitive: 'N', inverse: 'has-instance',
    strength: 0.95, polarity: 0, cardinality: 'N-1',
  },
  'has-instance': {
    cat: 'taxonomic', label: 'has instance',
    line: 'solid', glyph: 'circle-dot',
    symmetric: false, transitive: 'N', inverse: 'instance-of',
    strength: 0.95, polarity: 0, cardinality: '1-N',
  },

  // structural ───────────────────────────────────────────────────────────
  'part-of': {
    cat: 'structural', label: 'part of',
    line: 'solid', glyph: 'diamond',
    symmetric: false, transitive: 'Y', inverse: 'contains',
    strength: 0.85, polarity: 0, cardinality: 'N-1',
  },
  'contains': {
    cat: 'structural', label: 'contains',
    line: 'solid', glyph: 'diamond-open',
    symmetric: false, transitive: 'Y', inverse: 'part-of',
    strength: 0.85, polarity: 0, cardinality: '1-N',
  },
  'made-of': {
    cat: 'structural', label: 'made of',
    line: 'dashed', glyph: 'hash',
    symmetric: false, transitive: 'weak', inverse: 'composes',
    strength: 0.75, polarity: 0, cardinality: 'N-N',
  },
  'composes': {
    cat: 'structural', label: 'composes',
    line: 'dashed', glyph: 'hash',
    symmetric: false, transitive: 'weak', inverse: 'made-of',
    strength: 0.75, polarity: 0, cardinality: 'N-N',
  },

  // causal ───────────────────────────────────────────────────────────────
  'causes': {
    cat: 'causal', label: 'causes',
    line: 'solid', glyph: 'arrow-right',
    symmetric: false, transitive: 'N', inverse: 'caused-by',
    strength: 0.85, polarity: 1, cardinality: 'N-N',
  },
  'caused-by': {
    cat: 'causal', label: 'caused by',
    line: 'solid', glyph: 'arrow-right',
    symmetric: false, transitive: 'N', inverse: 'causes',
    strength: 0.85, polarity: 1, cardinality: 'N-N',
  },
  'produces': {
    cat: 'causal', label: 'produces',
    line: 'solid', glyph: 'asterisk',
    symmetric: false, transitive: 'N', inverse: 'produced-by',
    strength: 0.70, polarity: 1, cardinality: 'N-N',
  },
  'produced-by': {
    cat: 'causal', label: 'produced by',
    line: 'solid', glyph: 'asterisk',
    symmetric: false, transitive: 'N', inverse: 'produces',
    strength: 0.70, polarity: 1, cardinality: 'N-N',
  },
  'enables': {
    cat: 'causal', label: 'enables',
    line: 'dotted', glyph: 'key',
    symmetric: false, transitive: 'weak', inverse: 'enabled-by',
    strength: 0.60, polarity: 1, cardinality: 'N-N',
  },
  'enabled-by': {
    cat: 'causal', label: 'enabled by',
    line: 'dotted', glyph: 'key',
    symmetric: false, transitive: 'weak', inverse: 'enables',
    strength: 0.60, polarity: 1, cardinality: 'N-N',
  },
  'prevents': {
    cat: 'causal', label: 'prevents',
    line: 'dotted', glyph: 'block',
    symmetric: false, transitive: 'N', inverse: 'prevented-by',
    strength: 0.85, polarity: -1, cardinality: 'N-N',
  },
  'prevented-by': {
    cat: 'causal', label: 'prevented by',
    line: 'dotted', glyph: 'block',
    symmetric: false, transitive: 'N', inverse: 'prevents',
    strength: 0.85, polarity: -1, cardinality: 'N-N',
  },
  'triggers': {
    cat: 'causal', label: 'triggers',
    line: 'solid', glyph: 'spark',
    symmetric: false, transitive: 'N', inverse: 'triggered-by',
    strength: 0.70, polarity: 1, cardinality: 'N-N',
  },
  'triggered-by': {
    cat: 'causal', label: 'triggered by',
    line: 'solid', glyph: 'spark',
    symmetric: false, transitive: 'N', inverse: 'triggers',
    strength: 0.70, polarity: 1, cardinality: 'N-N',
  },
  'inhibits': {
    cat: 'causal', label: 'inhibits',
    line: 'dotted', glyph: 'minus',
    symmetric: false, transitive: 'N', inverse: 'inhibited-by',
    strength: 0.55, polarity: -1, cardinality: 'N-N',
  },
  'inhibited-by': {
    cat: 'causal', label: 'inhibited by',
    line: 'dotted', glyph: 'minus',
    symmetric: false, transitive: 'N', inverse: 'inhibits',
    strength: 0.55, polarity: -1, cardinality: 'N-N',
  },
  'disables': {
    cat: 'causal', label: 'disables',
    line: 'dotted', glyph: 'lock',
    symmetric: false, transitive: 'weak', inverse: 'disabled-by',
    strength: 0.60, polarity: -1, cardinality: 'N-N',
  },
  'disabled-by': {
    cat: 'causal', label: 'disabled by',
    line: 'dotted', glyph: 'lock',
    symmetric: false, transitive: 'weak', inverse: 'disables',
    strength: 0.60, polarity: -1, cardinality: 'N-N',
  },
  'consumes': {
    cat: 'causal', label: 'consumes',
    line: 'solid', glyph: 'flame',
    symmetric: false, transitive: 'N', inverse: 'consumed-by',
    strength: 0.65, polarity: -1, cardinality: 'N-N',
  },
  'consumed-by': {
    cat: 'causal', label: 'consumed by',
    line: 'solid', glyph: 'flame',
    symmetric: false, transitive: 'N', inverse: 'consumes',
    strength: 0.65, polarity: -1, cardinality: 'N-N',
  },
  'delays': {
    cat: 'causal', label: 'delays',
    line: 'dotted', glyph: 'hourglass',
    symmetric: false, transitive: 'weak', inverse: 'delayed-by',
    strength: 0.55, polarity: -1, cardinality: 'N-N',
  },
  'delayed-by': {
    cat: 'causal', label: 'delayed by',
    line: 'dotted', glyph: 'hourglass',
    symmetric: false, transitive: 'weak', inverse: 'delays',
    strength: 0.55, polarity: -1, cardinality: 'N-N',
  },

  // dependency ───────────────────────────────────────────────────────────
  'requires': {
    cat: 'dependency', label: 'requires',
    line: 'solid', glyph: 'anchor',
    symmetric: false, transitive: 'Y', inverse: 'required-by',
    strength: 0.85, polarity: 0, cardinality: 'N-N',
  },
  'required-by': {
    cat: 'dependency', label: 'required by',
    line: 'solid', glyph: 'anchor',
    symmetric: false, transitive: 'Y', inverse: 'requires',
    strength: 0.85, polarity: 0, cardinality: 'N-N',
  },
  'uses': {
    cat: 'dependency', label: 'uses',
    line: 'dashed', glyph: 'tool',
    symmetric: false, transitive: 'weak', inverse: 'used-by',
    strength: 0.50, polarity: 0, cardinality: 'N-N',
  },
  'used-by': {
    cat: 'dependency', label: 'used by',
    line: 'dashed', glyph: 'tool',
    symmetric: false, transitive: 'weak', inverse: 'uses',
    strength: 0.50, polarity: 0, cardinality: 'N-N',
  },
  'used-for': {
    cat: 'dependency', label: 'used for',
    line: 'dashed', glyph: 'flag',
    symmetric: false, transitive: 'N', inverse: 'purpose-of',
    strength: 0.55, polarity: 1, cardinality: 'N-N',
  },
  'purpose-of': {
    cat: 'dependency', label: 'purpose of',
    line: 'dashed', glyph: 'flag',
    symmetric: false, transitive: 'N', inverse: 'used-for',
    strength: 0.55, polarity: 1, cardinality: 'N-N',
  },

  // temporal ─────────────────────────────────────────────────────────────
  'precedes': {
    cat: 'temporal', label: 'precedes',
    line: 'solid', glyph: 'chevron-r',
    symmetric: false, transitive: 'Y', inverse: 'follows',
    strength: 0.50, polarity: 0, cardinality: 'N-N',
  },
  'follows': {
    cat: 'temporal', label: 'follows',
    line: 'solid', glyph: 'chevron-r',
    symmetric: false, transitive: 'Y', inverse: 'precedes',
    strength: 0.50, polarity: 0, cardinality: 'N-N',
  },
  'occurs-in': {
    cat: 'temporal', label: 'occurs in',
    line: 'dotted', glyph: 'ring',
    symmetric: false, transitive: 'Y', inverse: 'has-occurrence',
    strength: 0.40, polarity: 0, cardinality: 'N-1',
  },
  'has-occurrence': {
    cat: 'temporal', label: 'has occurrence',
    line: 'dotted', glyph: 'ring',
    symmetric: false, transitive: 'Y', inverse: 'occurs-in',
    strength: 0.40, polarity: 0, cardinality: '1-N',
  },
  'during': {
    cat: 'temporal', label: 'during',
    line: 'solid', glyph: 'brackets',
    symmetric: false, transitive: 'Y', inverse: 'spans',
    strength: 0.55, polarity: 0, cardinality: 'N-1',
  },
  'spans': {
    cat: 'temporal', label: 'spans',
    line: 'solid', glyph: 'brackets',
    symmetric: false, transitive: 'Y', inverse: 'during',
    strength: 0.55, polarity: 0, cardinality: '1-N',
  },
  'overlaps-with': {
    cat: 'temporal', label: 'overlaps with',
    line: 'dashed', glyph: 'overlap',
    symmetric: true, transitive: 'N', inverse: 'overlaps-with',
    strength: 0.45, polarity: 0, cardinality: 'N-N',
  },
  'derives-from': {
    cat: 'temporal', label: 'derives from',
    line: 'solid', glyph: 'branch',
    symmetric: false, transitive: 'Y', inverse: 'gives-rise-to',
    strength: 0.70, polarity: 0, cardinality: 'N-1',
  },
  'gives-rise-to': {
    cat: 'temporal', label: 'gives rise to',
    line: 'solid', glyph: 'branch',
    symmetric: false, transitive: 'Y', inverse: 'derives-from',
    strength: 0.70, polarity: 0, cardinality: '1-N',
  },

  // opposition (symmetric, self-inverse) ─────────────────────────────────
  'contrasts-with': {
    cat: 'opposition', label: 'contrasts with',
    line: 'wavy', glyph: 'tilde',
    symmetric: true, transitive: 'N', inverse: 'contrasts-with',
    strength: 0.50, polarity: -1, cardinality: 'N-N',
  },
  'opposite-of': {
    cat: 'opposition', label: 'opposite of',
    line: 'double', glyph: 'x',
    symmetric: true, transitive: 'N', inverse: 'opposite-of',
    strength: 0.80, polarity: -1, cardinality: '1-1',
  },

  // similarity (symmetric, self-inverse) ─────────────────────────────────
  'similar-to': {
    cat: 'similarity', label: 'similar to',
    line: 'dashed', glyph: 'approx',
    symmetric: true, transitive: 'weak', inverse: 'similar-to',
    strength: 0.40, polarity: 1, cardinality: 'N-N',
  },
  'analogous-to': {
    cat: 'similarity', label: 'analogous to',
    line: 'dotted', glyph: 'arrows-lr',
    symmetric: true, transitive: 'N', inverse: 'analogous-to',
    strength: 0.30, polarity: 1, cardinality: 'N-N',
  },

  // epistemic ────────────────────────────────────────────────────────────
  'supports': {
    cat: 'epistemic', label: 'supports',
    line: 'dotted', glyph: 'check',
    symmetric: false, transitive: 'weak', inverse: 'supported-by',
    strength: 0.70, polarity: 1, cardinality: 'N-N',
  },
  'supported-by': {
    cat: 'epistemic', label: 'supported by',
    line: 'dotted', glyph: 'check',
    symmetric: false, transitive: 'weak', inverse: 'supports',
    strength: 0.70, polarity: 1, cardinality: 'N-N',
  },
  'contradicts': {
    cat: 'epistemic', label: 'contradicts',
    line: 'dotted', glyph: 'slash',
    symmetric: true, transitive: 'N', inverse: 'contradicts',
    strength: 0.75, polarity: -1, cardinality: 'N-N',
  },
  'explains': {
    cat: 'epistemic', label: 'explains',
    line: 'solid', glyph: 'bulb',
    symmetric: false, transitive: 'weak', inverse: 'explained-by',
    strength: 0.80, polarity: 0, cardinality: 'N-N',
  },
  'explained-by': {
    cat: 'epistemic', label: 'explained by',
    line: 'solid', glyph: 'bulb',
    symmetric: false, transitive: 'weak', inverse: 'explains',
    strength: 0.80, polarity: 0, cardinality: 'N-N',
  },
  'defines': {
    cat: 'epistemic', label: 'defines',
    line: 'solid', glyph: 'equals',
    symmetric: false, transitive: 'N', inverse: 'defined-by',
    strength: 0.90, polarity: 0, cardinality: '1-1',
  },
  'defined-by': {
    cat: 'epistemic', label: 'defined by',
    line: 'solid', glyph: 'equals',
    symmetric: false, transitive: 'N', inverse: 'defines',
    strength: 0.90, polarity: 0, cardinality: '1-1',
  },
}

export const RELATION_TYPE_VALUES = Object.keys(RELATION_TYPES) as EdgeTypeName[]
