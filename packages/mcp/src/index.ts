#!/usr/bin/env node
// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs'
import { McpServer, StdioServerTransport } from '@modelcontextprotocol/server'
import { registerGetRelationTypes } from './tools/get-relation-types.js'
import { registerGetDocs } from './tools/get-docs.js'

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string }

const server = new McpServer({
  name: 'nesso',
  version,
})

registerGetRelationTypes(server)
registerGetDocs(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Nesso MCP server running on stdio')
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
