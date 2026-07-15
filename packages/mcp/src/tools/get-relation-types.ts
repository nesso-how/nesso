// SPDX-License-Identifier: MIT
import type { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'
import {
  RELATION_TYPES,
  RELATION_CATEGORIES,
  type GlyphKind,
  type RelationCategory,
  type RelationTypeName,
  type Transitivity,
  type Polarity,
  type Cardinality,
} from '@nesso-how/vocab-learning'

export type RelationTypePayload = {
  type: RelationTypeName
  label: string
  glyph: GlyphKind
  symmetric: boolean
  transitive: Transitivity
  inverse: RelationTypeName | 'self'
  strength: number
  polarity: Polarity
  cardinality: Cardinality
}

export type RelationTypesPayload = Array<{
  category: RelationCategory
  types: RelationTypePayload[]
}>

export function getRelationTypesPayload(): RelationTypesPayload {
  return RELATION_CATEGORIES.map((cat) => ({
    category: cat,
    types: Object.entries(RELATION_TYPES)
      .filter(([, def]) => def.cat === cat)
      .map(([name, def]) => ({
        type: name as RelationTypeName,
        label: def.label,
        glyph: def.glyph,
        symmetric: def.inverse === 'self',
        transitive: def.transitive,
        inverse: def.inverse,
        strength: def.strength,
        polarity: def.polarity,
        cardinality: def.cardinality,
      })),
  }))
}

export function registerGetRelationTypes(server: McpServer): void {
  server.registerTool(
    'get_relation_types',
    {
      description:
        'Returns all 52 semantic relation types supported by Nesso, grouped by 8 categories. ' +
        'Each type carries type properties (transitive, inverse, strength, polarity, cardinality) ' +
        'in addition to its glyph. ' +
        'Use this when you need valid relation type names for graph JSON or explanations for the user.',
      inputSchema: z.object({}),
    },
    async () => {
      const result = getRelationTypesPayload()

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    },
  )
}
