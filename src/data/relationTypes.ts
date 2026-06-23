// SPDX-License-Identifier: MIT
import {
  RELATION_TYPES,
  RELATION_TYPE_VALUES,
  RELATION_CATEGORY_META,
  isPrimaryRelationType,
  type EdgeCategory,
  type EdgeTypeName,
} from '@nesso-how/vocab-learning'

export { RELATION_TYPES, RELATION_TYPE_VALUES, isPrimaryRelationType }

/** Coerce persisted / React Flow edge `data.type` to a known relation id. */
export function asEdgeTypeName(value: unknown, fallback: EdgeTypeName = 'causes'): EdgeTypeName {
  return typeof value === 'string' && value in RELATION_TYPES ? (value as EdgeTypeName) : fallback
}

export const RELATION_CATEGORIES = Object.fromEntries(
  (Object.keys(RELATION_CATEGORY_META) as EdgeCategory[]).map((cat) => [
    cat,
    {
      ...RELATION_CATEGORY_META[cat],
      color: `var(--cat-${cat})`,
    },
  ]),
) as Record<EdgeCategory, { label: string; subtitle: string; color: string }>

type RelationCategoryInfo = (typeof RELATION_CATEGORIES)[EdgeCategory]
type RelationTypeDef = (typeof RELATION_TYPES)[EdgeTypeName]

export interface RelationGroup extends RelationCategoryInfo {
  key: EdgeCategory
  types: [EdgeTypeName, RelationTypeDef][]
}

/**
 * Group relation types by category, keeping only the types for which
 * `keep` returns true and dropping empty categories. Shared by the relation
 * picker and the relation-types reference dialog.
 */
export function buildRelationGroups(
  keep: (id: EdgeTypeName, def: RelationTypeDef) => boolean,
): RelationGroup[] {
  return (Object.entries(RELATION_CATEGORIES) as [EdgeCategory, RelationCategoryInfo][])
    .map(([key, info]) => ({
      key,
      ...info,
      types: (Object.entries(RELATION_TYPES) as [EdgeTypeName, RelationTypeDef][]).filter(
        ([id, def]) => def.cat === key && keep(id, def),
      ),
    }))
    .filter((g) => g.types.length > 0)
}
