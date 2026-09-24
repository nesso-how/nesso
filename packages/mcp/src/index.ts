#!/usr/bin/env node
// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { createNessoServer } from './server.js'

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string }

const server = createNessoServer(version)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Nesso MCP server running on stdio')
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
