import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { type TestContext } from 'node:test'
import { createAiConnections } from './ai-connections.ts'
import { createAiStorage } from './ai-storage.ts'
import { ElectronError } from './errors.ts'

const fixture = (context: TestContext) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'nesso-ai-'))
  context.after(() => rmSync(directory, { recursive: true, force: true }))
  const file = path.join(directory, 'ai-connections.enc')
  const encryption = {
    isEncryptionAvailable: context.mock.fn(() => true),
    getSelectedStorageBackend: () => 'gnome_libsecret' as const,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
    decryptString: context.mock.fn((value: Buffer) => value.toString().slice('encrypted:'.length)),
  }
  return { file, encryption, storage: createAiStorage(file, encryption) }
}
const input = { name: 'OpenAI', provider: 'openai' as const, endpoint: 'https://api.openai.com/v1', model: 'model', apiKey: 'secret' }

test('secure storage is accessed only when saving or reading existing credentials', async (context) => {
  const { file, encryption, storage } = fixture(context)
  const connections = createAiConnections(storage)
  assert.deepEqual(connections.list(), { connections: [], activeId: null, accounts: [] })
  assert.equal(encryption.isEncryptionAvailable.mock.callCount(), 0)
  connections.save(input)
  assert.equal(encryption.isEncryptionAvailable.mock.callCount(), 1)
  const restarted = createAiConnections(createAiStorage(file, encryption))
  assert.equal(encryption.isEncryptionAvailable.mock.callCount(), 1)
  assert.equal(encryption.decryptString.mock.callCount(), 0)
  assert.equal((await restarted.active()).apiKey, input.apiKey)
  assert.equal(encryption.decryptString.mock.callCount(), 1)
})

test('unavailable encryption and insecure Linux backends preserve existing connections', (context) => {
  const { file, encryption, storage } = fixture(context)
  createAiConnections(storage).save(input)
  const before = readFileSync(file)
  for (const unavailable of [
    createAiStorage(file, { ...encryption, isEncryptionAvailable: () => false }),
    createAiStorage(file, { ...encryption, getSelectedStorageBackend: () => 'basic_text' }, 'linux'),
  ]) {
    assert.throws(() => unavailable.read(), ElectronError)
    assert.throws(() => unavailable.write('replacement'), ElectronError)
  }
  assert.deepEqual(readFileSync(file), before)
})
