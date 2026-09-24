// SPDX-License-Identifier: MIT
import { McpServer } from '@modelcontextprotocol/server'
import { registerBuildGraph } from './tools/build-graph.js'
import { registerGetRelationTypes } from './tools/get-relation-types.js'
import { registerGetDocs } from './tools/get-docs.js'
import { registerValidateGraph } from './tools/validate-graph.js'

export const SERVER_NAME = 'nesso'

export const SERVER_INSTRUCTIONS =
  'Nesso builds typed knowledge graphs for active learning. ' +
  'Call get_relation_types before build_graph to use valid relation type ids. ' +
  'Run validate_graph on any graph JSON before writing it back to disk. ' +
  'Call get_nesso_docs without a slug to list documentation pages.'

/** Compose the Nesso MCP server with every registered tool. */
export function createNessoServer(version: string): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version },
    { instructions: SERVER_INSTRUCTIONS },
  )
  registerGetRelationTypes(server)
  registerGetDocs(server)
  registerValidateGraph(server)
  registerBuildGraph(server)
  return server
}
