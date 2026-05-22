// SPDX-License-Identifier: MIT
import type { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'
import { RELATION_TYPES, RELATION_CATEGORY_META } from '@nesso-how/relation-types'

export function registerGetRelationTypes(server: McpServer): void {
  server.registerTool(
    'get_relation_types',
    {
      description:
        'Returns all 41 semantic relation types supported by Nesso, grouped by 8 categories. ' +
        'Each type carries semantic coefficients (transitive, inverse, strength, polarity, cardinality) ' +
        'in addition to its visual encoding. ' +
        'Use this when you need valid relation type names for graph JSON or explanations for the user.',
      inputSchema: z.object({}),
    },
    async () => {
      const result = Object.entries(RELATION_CATEGORY_META).map(([cat, catDef]) => ({
        category: catDef.label,
        question: catDef.subtitle,
        types: Object.entries(RELATION_TYPES)
          .filter(([, def]) => def.cat === cat)
          .map(([name, def]) => ({
            type: name,
            label: def.label,
            line: def.line,
            symmetric: def.symmetric,
            transitive: def.transitive,
            inverse: def.inverse,
            strength: def.strength,
            polarity: def.polarity,
            cardinality: def.cardinality,
          })),
      }))

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    },
  )
}
