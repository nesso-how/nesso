// SPDX-License-Identifier: MIT
import {
  RELATION_TYPES,
  RELATION_TYPE_VALUES,
  RELATION_CATEGORY_META,
  type EdgeCategory,
} from '@nesso-how/relation-types'

export { RELATION_TYPES, RELATION_TYPE_VALUES }

export const RELATION_CATEGORIES = Object.fromEntries(
  (Object.keys(RELATION_CATEGORY_META) as EdgeCategory[]).map((cat) => [
    cat,
    {
      ...RELATION_CATEGORY_META[cat],
      color: `var(--cat-${cat})`,
    },
  ]),
) as Record<EdgeCategory, { label: string; subtitle: string; color: string }>
