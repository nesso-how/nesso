// SPDX-License-Identifier: MIT
//
// Semantic relation vocabulary: ordered categories, 52 typed relation ids, and
// per-type properties (transitive, inverse, strength, polarity, cardinality)
// plus the category colour as the visual channel. UI labels live in app i18n, not here.
//
// Inverse types are derived from the primaries table below: each pair stores
// the primary fields once plus the inverse name/label. The derived record is
// field-by-field identical to the former hand-written literals.

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

/** Transitivity of a relation: `Y` strict, `N` none, `weak` with decay (algorithms may discount weight per step). */
export type Transitivity = 'Y' | 'N' | 'weak'

/** Polarity in signed-network terms: `+1` positive effect, `-1` antagonistic, `0` neutral/structural. */
export type Polarity = -1 | 0 | 1

/** Expected mapping cardinality. `N-N` means no a-priori constraint. */
export type Cardinality = '1-1' | '1-N' | 'N-1' | 'N-N'

export interface RelationTypeDef {
  cat: RelationCategory
  label: string
  // type properties
  transitive: Transitivity
  /** Canonical inverse in the set; `'self'` for symmetric types. */
  inverse: RelationTypeName | 'self'
  /** Per-type semantic weight in 0..1; intensity, not per-edge confidence. */
  strength: number
  polarity: Polarity
  cardinality: Cardinality
}

interface InverseSpec {
  name: RelationTypeName
  label: string
}

interface PrimaryRelationSpec {
  name: RelationTypeName
  cat: RelationCategory
  label: string
  transitive: Transitivity
  strength: number
  polarity: Polarity
  cardinality: Cardinality
  /** Absent for symmetric types (`inverse: 'self'`). */
  inverse?: InverseSpec
}

/** Compact primaries table in canonical `RELATION_TYPE_VALUES` order. */
const PRIMARY_RELATION_SPECS: readonly PrimaryRelationSpec[] = [
  // taxonomic ────────────────────────────────────────────────────────────
  {
    name: 'subtype-of',
    cat: 'taxonomic',
    label: 'subtype of',
    transitive: 'Y',
    strength: 0.9,
    polarity: 0,
    cardinality: 'N-1',
    inverse: { name: 'has-subtype', label: 'has subtype' },
  },
  {
    name: 'instance-of',
    cat: 'taxonomic',
    label: 'instance of',
    transitive: 'N',
    strength: 0.95,
    polarity: 0,
    cardinality: 'N-1',
    inverse: { name: 'has-instance', label: 'has instance' },
  },

  // structural ───────────────────────────────────────────────────────────
  {
    name: 'part-of',
    cat: 'structural',
    label: 'part of',
    transitive: 'Y',
    strength: 0.85,
    polarity: 0,
    cardinality: 'N-1',
    inverse: { name: 'contains', label: 'contains' },
  },
  {
    name: 'made-of',
    cat: 'structural',
    label: 'made of',
    transitive: 'weak',
    strength: 0.75,
    polarity: 0,
    cardinality: 'N-N',
    inverse: { name: 'composes', label: 'composes' },
  },

  // causal ───────────────────────────────────────────────────────────────
  {
    name: 'causes',
    cat: 'causal',
    label: 'causes',
    transitive: 'N',
    strength: 0.85,
    polarity: 1,
    cardinality: 'N-N',
    inverse: { name: 'caused-by', label: 'caused by' },
  },
  {
    name: 'produces',
    cat: 'causal',
    label: 'produces',
    transitive: 'N',
    strength: 0.7,
    polarity: 1,
    cardinality: 'N-N',
    inverse: { name: 'produced-by', label: 'produced by' },
  },
  {
    name: 'enables',
    cat: 'causal',
    label: 'enables',
    transitive: 'weak',
    strength: 0.6,
    polarity: 1,
    cardinality: 'N-N',
    inverse: { name: 'enabled-by', label: 'enabled by' },
  },
  {
    name: 'prevents',
    cat: 'causal',
    label: 'prevents',
    transitive: 'N',
    strength: 0.85,
    polarity: -1,
    cardinality: 'N-N',
    inverse: { name: 'prevented-by', label: 'prevented by' },
  },
  {
    name: 'triggers',
    cat: 'causal',
    label: 'triggers',
    transitive: 'N',
    strength: 0.7,
    polarity: 1,
    cardinality: 'N-N',
    inverse: { name: 'triggered-by', label: 'triggered by' },
  },
  {
    name: 'inhibits',
    cat: 'causal',
    label: 'inhibits',
    transitive: 'N',
    strength: 0.55,
    polarity: -1,
    cardinality: 'N-N',
    inverse: { name: 'inhibited-by', label: 'inhibited by' },
  },
  {
    name: 'disables',
    cat: 'causal',
    label: 'disables',
    transitive: 'weak',
    strength: 0.6,
    polarity: -1,
    cardinality: 'N-N',
    inverse: { name: 'disabled-by', label: 'disabled by' },
  },
  {
    name: 'consumes',
    cat: 'causal',
    label: 'consumes',
    transitive: 'N',
    strength: 0.65,
    polarity: -1,
    cardinality: 'N-N',
    inverse: { name: 'consumed-by', label: 'consumed by' },
  },
  {
    name: 'delays',
    cat: 'causal',
    label: 'delays',
    transitive: 'weak',
    strength: 0.55,
    polarity: -1,
    cardinality: 'N-N',
    inverse: { name: 'delayed-by', label: 'delayed by' },
  },

  // dependency ───────────────────────────────────────────────────────────
  {
    name: 'requires',
    cat: 'dependency',
    label: 'requires',
    transitive: 'Y',
    strength: 0.85,
    polarity: 0,
    cardinality: 'N-N',
    inverse: { name: 'required-by', label: 'required by' },
  },
  {
    name: 'uses',
    cat: 'dependency',
    label: 'uses',
    transitive: 'weak',
    strength: 0.5,
    polarity: 0,
    cardinality: 'N-N',
    inverse: { name: 'used-by', label: 'used by' },
  },
  {
    name: 'used-for',
    cat: 'dependency',
    label: 'used for',
    transitive: 'N',
    strength: 0.55,
    polarity: 1,
    cardinality: 'N-N',
    inverse: { name: 'purpose-of', label: 'purpose of' },
  },

  // temporal ─────────────────────────────────────────────────────────────
  {
    name: 'precedes',
    cat: 'temporal',
    label: 'precedes',
    transitive: 'Y',
    strength: 0.5,
    polarity: 0,
    cardinality: 'N-N',
    inverse: { name: 'follows', label: 'follows' },
  },
  {
    name: 'occurs-in',
    cat: 'temporal',
    label: 'occurs in',
    transitive: 'Y',
    strength: 0.4,
    polarity: 0,
    cardinality: 'N-1',
    inverse: { name: 'has-occurrence', label: 'has occurrence' },
  },
  {
    name: 'during',
    cat: 'temporal',
    label: 'during',
    transitive: 'Y',
    strength: 0.55,
    polarity: 0,
    cardinality: 'N-1',
    inverse: { name: 'spans', label: 'spans' },
  },
  {
    name: 'overlaps-with',
    cat: 'temporal',
    label: 'overlaps with',
    transitive: 'N',
    strength: 0.45,
    polarity: 0,
    cardinality: 'N-N',
  },
  {
    name: 'derives-from',
    cat: 'temporal',
    label: 'derives from',
    transitive: 'Y',
    strength: 0.7,
    polarity: 0,
    cardinality: 'N-1',
    inverse: { name: 'gives-rise-to', label: 'gives rise to' },
  },

  // opposition ───────────────────────────────────────────────────────────
  {
    name: 'contrasts-with',
    cat: 'opposition',
    label: 'contrasts with',
    transitive: 'N',
    strength: 0.5,
    polarity: -1,
    cardinality: 'N-N',
  },
  {
    name: 'opposite-of',
    cat: 'opposition',
    label: 'opposite of',
    transitive: 'N',
    strength: 0.8,
    polarity: -1,
    cardinality: '1-1',
  },

  // similarity ───────────────────────────────────────────────────────────
  {
    name: 'similar-to',
    cat: 'similarity',
    label: 'similar to',
    transitive: 'weak',
    strength: 0.4,
    polarity: 1,
    cardinality: 'N-N',
  },
  {
    name: 'analogous-to',
    cat: 'similarity',
    label: 'analogous to',
    transitive: 'N',
    strength: 0.3,
    polarity: 1,
    cardinality: 'N-N',
  },

  // epistemic ────────────────────────────────────────────────────────────
  {
    name: 'supports',
    cat: 'epistemic',
    label: 'supports',
    transitive: 'weak',
    strength: 0.7,
    polarity: 1,
    cardinality: 'N-N',
    inverse: { name: 'supported-by', label: 'supported by' },
  },
  {
    name: 'contradicts',
    cat: 'epistemic',
    label: 'contradicts',
    transitive: 'N',
    strength: 0.75,
    polarity: -1,
    cardinality: 'N-N',
  },
  {
    name: 'explains',
    cat: 'epistemic',
    label: 'explains',
    transitive: 'weak',
    strength: 0.8,
    polarity: 0,
    cardinality: 'N-N',
    inverse: { name: 'explained-by', label: 'explained by' },
  },
  {
    name: 'defines',
    cat: 'epistemic',
    label: 'defines',
    transitive: 'N',
    strength: 0.9,
    polarity: 0,
    cardinality: '1-1',
    inverse: { name: 'defined-by', label: 'defined by' },
  },
]

function flipCardinality(cardinality: Cardinality): Cardinality {
  if (cardinality === 'N-1') return '1-N'
  if (cardinality === '1-N') return 'N-1'
  return cardinality
}

function buildRelationTypes(): Record<RelationTypeName, RelationTypeDef> {
  const entries: [RelationTypeName, RelationTypeDef][] = []
  for (const spec of PRIMARY_RELATION_SPECS) {
    if (spec.inverse === undefined) {
      entries.push([
        spec.name,
        {
          cat: spec.cat,
          label: spec.label,
          transitive: spec.transitive,
          inverse: 'self',
          strength: spec.strength,
          polarity: spec.polarity,
          cardinality: spec.cardinality,
        },
      ])
      continue
    }
    entries.push([
      spec.name,
      {
        cat: spec.cat,
        label: spec.label,
        transitive: spec.transitive,
        inverse: spec.inverse.name,
        strength: spec.strength,
        polarity: spec.polarity,
        cardinality: spec.cardinality,
      },
    ])
    entries.push([
      spec.inverse.name,
      {
        cat: spec.cat,
        label: spec.inverse.label,
        transitive: spec.transitive,
        inverse: spec.name,
        strength: spec.strength,
        polarity: spec.polarity,
        cardinality: flipCardinality(spec.cardinality),
      },
    ])
  }
  return Object.fromEntries(entries) as Record<RelationTypeName, RelationTypeDef>
}

export const RELATION_TYPES: Record<RelationTypeName, RelationTypeDef> = buildRelationTypes()

export const RELATION_TYPE_VALUES = Object.keys(RELATION_TYPES) as RelationTypeName[]

/** Forward member of each inverse pair (first in `RELATION_TYPE_VALUES`); all symmetric types. */
export function isPrimaryRelationType(id: RelationTypeName): boolean {
  const def = RELATION_TYPES[id]
  if (def.inverse === 'self') return true
  return RELATION_TYPE_VALUES.indexOf(id) < RELATION_TYPE_VALUES.indexOf(def.inverse)
}

/** Default relation type used when persisted edge data carries an unknown id. */
export const DEFAULT_RELATION_TYPE: RelationTypeName = 'causes'

/** Coerce persisted / React Flow edge `data.type` to a known relation id. */
export function asRelationTypeName(
  value: unknown,
  fallback: RelationTypeName = DEFAULT_RELATION_TYPE,
): RelationTypeName {
  return typeof value === 'string' && value in RELATION_TYPES
    ? (value as RelationTypeName)
    : fallback
}
