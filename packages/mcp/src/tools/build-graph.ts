// SPDX-License-Identifier: MIT
import type { McpServer } from '@modelcontextprotocol/server'
import { buildGraphInputSchema, buildGraphJson } from '../lib/graph-tools.js'

export function registerBuildGraph(server: McpServer): void {
  server.registerTool(
    'build_graph',
    {
      description:
        'Build a valid Nesso graph document JSON from structured concepts and relations. ' +
        'Assigns ids, vocabulary metadata, relation types, and dagre layout positions. ' +
        'Returns importable JSON for the client to write to disk.',
      inputSchema: buildGraphInputSchema,
    },
    async (input) => {
      try {
        const json = buildGraphJson(input)
        return {
          content: [{ type: 'text' as const, text: json }],
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: err instanceof Error ? err.message : String(err),
            },
          ],
          isError: true,
        }
      }
    },
  )
}
