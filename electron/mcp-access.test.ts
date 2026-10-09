import assert from 'node:assert/strict'
import test from 'node:test'
import { createMcpAccess } from './mcp-access.ts'
import { ElectronError } from './errors.ts'

test('MCP access persists until revoked and preserves stored credentials on validation or write failure', () => {
  let stored: string | null = null
  let blocked = false
  const storage = { read: () => stored, write: (value: string) => {
    if (blocked) throw new ElectronError([{ path: 'storage', message: 'Write failed' }])
    stored = value
  } }
  const access = createMcpAccess(storage)
  const token = access.get()
  assert.equal(createMcpAccess(storage).get(), token)
  access.revoke()
  const renewed = access.get()
  assert.notEqual(renewed, token)
  blocked = true
  assert.throws(access.revoke, /Write failed/)
  assert.equal(access.get(), renewed)
  stored = 'unreadable'
  assert.throws(access.get, ElectronError)
  assert.equal(stored, 'unreadable')
  stored = null
  assert.throws(access.get, /Write failed/)
  assert.equal(stored, null)
})
