// SPDX-License-Identifier: MIT
import type { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'
import { validateGraphJson } from '../lib/graph-tools.js'

export function registerValidateGraph(server: McpServer): void {
  server.registerTool(
    'validate_graph',
    {
      description:
        'Validate a Nesso graph document JSON string. Returns valid, errors, and warnings. ' +
        'Checks envelope shape, vocabulary rules, duplicate ids, dangling relation endpoints, ' +
        'and known relation types. Use after reading a graph file or before writing one back.',
      inputSchema: z.object({
        graph: z.string().describe('Nesso graph document as a JSON string'),
      }),
    },
    async ({ graph }) => {
      const result = validateGraphJson(graph)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    },
  )
}
