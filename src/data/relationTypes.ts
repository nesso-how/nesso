// SPDX-License-Identifier: MIT
import {
  RELATION_TYPES,
  RELATION_TYPE_VALUES,
  RELATION_CATEGORY_META,
  type EdgeCategory,
  type EdgeTypeName,
} from '@nesso-how/relation-types'

export { RELATION_TYPES, RELATION_TYPE_VALUES }

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
