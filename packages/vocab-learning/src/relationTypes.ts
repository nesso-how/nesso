// SPDX-License-Identifier: MIT
//
// Semantic relation vocabulary: ordered categories, 52 typed relation ids, and
// per-type identity (category, label, inverse) plus the category colour as the
// visual channel. UI labels live in app i18n, not here.
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

export interface RelationTypeDef {
  cat: RelationCategory
  label: string
  /** Canonical inverse in the set; `'self'` for symmetric types. */
  inverse: RelationTypeName | 'self'
}

interface InverseSpec {
  name: RelationTypeName
  label: string
}

interface PrimaryRelationSpec {
  name: RelationTypeName
  cat: RelationCategory
  label: string
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
    inverse: { name: 'has-subtype', label: 'has subtype' },
  },
  {
    name: 'instance-of',
    cat: 'taxonomic',
    label: 'instance of',
    inverse: { name: 'has-instance', label: 'has instance' },
  },

  // structural ───────────────────────────────────────────────────────────
  {
    name: 'part-of',
    cat: 'structural',
    label: 'part of',
    inverse: { name: 'contains', label: 'contains' },
  },
  {
    name: 'made-of',
    cat: 'structural',
    label: 'made of',
    inverse: { name: 'composes', label: 'composes' },
  },

  // causal ───────────────────────────────────────────────────────────────
  {
    name: 'causes',
    cat: 'causal',
    label: 'causes',
    inverse: { name: 'caused-by', label: 'caused by' },
  },
  {
    name: 'produces',
    cat: 'causal',
    label: 'produces',
    inverse: { name: 'produced-by', label: 'produced by' },
  },
  {
    name: 'enables',
    cat: 'causal',
    label: 'enables',
    inverse: { name: 'enabled-by', label: 'enabled by' },
  },
  {
    name: 'prevents',
    cat: 'causal',
    label: 'prevents',
    inverse: { name: 'prevented-by', label: 'prevented by' },
  },
  {
    name: 'triggers',
    cat: 'causal',
    label: 'triggers',
    inverse: { name: 'triggered-by', label: 'triggered by' },
  },
  {
    name: 'inhibits',
    cat: 'causal',
    label: 'inhibits',
    inverse: { name: 'inhibited-by', label: 'inhibited by' },
  },
  {
    name: 'disables',
    cat: 'causal',
    label: 'disables',
    inverse: { name: 'disabled-by', label: 'disabled by' },
  },
  {
    name: 'consumes',
    cat: 'causal',
    label: 'consumes',
    inverse: { name: 'consumed-by', label: 'consumed by' },
  },
  {
    name: 'delays',
    cat: 'causal',
    label: 'delays',
    inverse: { name: 'delayed-by', label: 'delayed by' },
  },

  // dependency ───────────────────────────────────────────────────────────
  {
    name: 'requires',
    cat: 'dependency',
    label: 'requires',
    inverse: { name: 'required-by', label: 'required by' },
  },
  {
    name: 'uses',
    cat: 'dependency',
    label: 'uses',
    inverse: { name: 'used-by', label: 'used by' },
  },
  {
    name: 'used-for',
    cat: 'dependency',
    label: 'used for',
    inverse: { name: 'purpose-of', label: 'purpose of' },
  },

  // temporal ─────────────────────────────────────────────────────────────
  {
    name: 'precedes',
    cat: 'temporal',
    label: 'precedes',
    inverse: { name: 'follows', label: 'follows' },
  },
  {
    name: 'occurs-in',
    cat: 'temporal',
    label: 'occurs in',
    inverse: { name: 'has-occurrence', label: 'has occurrence' },
  },
  {
    name: 'during',
    cat: 'temporal',
    label: 'during',
    inverse: { name: 'spans', label: 'spans' },
  },
  {
    name: 'overlaps-with',
    cat: 'temporal',
    label: 'overlaps with',
  },
  {
    name: 'derives-from',
    cat: 'temporal',
    label: 'derives from',
    inverse: { name: 'gives-rise-to', label: 'gives rise to' },
  },

  // opposition ───────────────────────────────────────────────────────────
  {
    name: 'contrasts-with',
    cat: 'opposition',
    label: 'contrasts with',
  },
  {
    name: 'opposite-of',
    cat: 'opposition',
    label: 'opposite of',
  },

  // similarity ───────────────────────────────────────────────────────────
  {
    name: 'similar-to',
    cat: 'similarity',
    label: 'similar to',
  },
  {
    name: 'analogous-to',
    cat: 'similarity',
    label: 'analogous to',
  },

  // epistemic ────────────────────────────────────────────────────────────
  {
    name: 'supports',
    cat: 'epistemic',
    label: 'supports',
    inverse: { name: 'supported-by', label: 'supported by' },
  },
  {
    name: 'contradicts',
    cat: 'epistemic',
    label: 'contradicts',
  },
  {
    name: 'explains',
    cat: 'epistemic',
    label: 'explains',
    inverse: { name: 'explained-by', label: 'explained by' },
  },
  {
    name: 'defines',
    cat: 'epistemic',
    label: 'defines',
    inverse: { name: 'defined-by', label: 'defined by' },
  },
]

function buildRelationTypes(): Record<RelationTypeName, RelationTypeDef> {
  const entries: [RelationTypeName, RelationTypeDef][] = []
  for (const spec of PRIMARY_RELATION_SPECS) {
    if (spec.inverse === undefined) {
      entries.push([
        spec.name,
        {
          cat: spec.cat,
          label: spec.label,
          inverse: 'self',
        },
      ])
      continue
    }
    entries.push([
      spec.name,
      {
        cat: spec.cat,
        label: spec.label,
        inverse: spec.inverse.name,
      },
    ])
    entries.push([
      spec.inverse.name,
      {
        cat: spec.cat,
        label: spec.inverse.label,
        inverse: spec.name,
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
