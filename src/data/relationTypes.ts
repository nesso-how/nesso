// SPDX-License-Identifier: MIT
import {
  RELATION_TYPES,
  RELATION_TYPE_VALUES,
  RELATION_CATEGORIES,
  isPrimaryRelationType,
  type RelationCategory,
  type RelationTypeName,
  type RelationTypeDef,
} from '@nesso-how/vocab-learning'

export { RELATION_TYPES, RELATION_TYPE_VALUES, isPrimaryRelationType }

/** Coerce persisted / React Flow edge `data.type` to a known relation id. */
export function asRelationTypeName(
  value: unknown,
  fallback: RelationTypeName = 'causes',
): RelationTypeName {
  return typeof value === 'string' && value in RELATION_TYPES
    ? (value as RelationTypeName)
    : fallback
}

/** Category id → CSS palette var for canvas/UI chrome. Labels live in i18n. */
export const RELATION_CATEGORY_COLORS = Object.fromEntries(
  RELATION_CATEGORIES.map((cat) => [cat, { color: `var(--cat-${cat})` }]),
) as Record<RelationCategory, { color: string }>

export interface RelationGroup {
  key: RelationCategory
  color: string
  types: [RelationTypeName, RelationTypeDef][]
}

/**
 * Group relation types by category, keeping only the types for which
 * `keep` returns true and dropping empty categories. Shared by the relation
 * picker and the relation-types reference dialog.
 */
export function buildRelationGroups(
  keep: (id: RelationTypeName, def: RelationTypeDef) => boolean,
): RelationGroup[] {
  return RELATION_CATEGORIES.map((key) => ({
    key,
    color: RELATION_CATEGORY_COLORS[key].color,
    types: (Object.entries(RELATION_TYPES) as [RelationTypeName, RelationTypeDef][]).filter(
      ([id, def]) => def.cat === key && keep(id, def),
    ),
  })).filter((g) => g.types.length > 0)
}
