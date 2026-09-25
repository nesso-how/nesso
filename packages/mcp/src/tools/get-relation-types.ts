// SPDX-License-Identifier: MIT
import type { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'
import {
  RELATION_TYPES,
  RELATION_CATEGORIES,
  RELATION_TYPE_VALUES,
  type RelationCategory,
  type RelationTypeName,
} from '@nesso-how/vocab-learning'

export type RelationTypePayload = {
  type: RelationTypeName
  label: string
  symmetric: boolean
  inverse: RelationTypeName | 'self'
}

export type RelationTypesPayload = Array<{
  category: RelationCategory
  types: RelationTypePayload[]
}>

const relationTypePayloadSchema = z.object({
  type: z.string(),
  label: z.string(),
  symmetric: z.boolean(),
  inverse: z.string(),
})

const getRelationTypesOutputSchema = z.object({
  categories: z.array(
    z.object({
      category: z.enum(RELATION_CATEGORIES),
      types: z.array(relationTypePayloadSchema),
    }),
  ),
})

export function getRelationTypesPayload(): RelationTypesPayload {
  return RELATION_CATEGORIES.map((cat) => ({
    category: cat,
    types: Object.entries(RELATION_TYPES)
      .filter(([, def]) => def.cat === cat)
      .map(([name, def]) => ({
        type: name as RelationTypeName,
        label: def.label,
        symmetric: def.inverse === 'self',
        inverse: def.inverse,
      })),
  }))
}

export function registerGetRelationTypes(server: McpServer): void {
  server.registerTool(
    'get_relation_types',
    {
      description:
        `Returns all ${RELATION_TYPE_VALUES.length} semantic relation types supported by Nesso, grouped by ${RELATION_CATEGORIES.length} categories. ` +
        'Each type carries its label, category, and canonical inverse (`self` for symmetric types). ' +
        'Use this when you need valid relation type names for graph JSON or explanations for the user.',
      inputSchema: z.object({}),
      outputSchema: getRelationTypesOutputSchema,
    },
    async () => {
      const result = getRelationTypesPayload()

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: { categories: result },
      }
    },
  )
}
