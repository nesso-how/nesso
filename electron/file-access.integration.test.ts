import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { readChosenFile, saveChosenFile } from './file-access.ts'

test('chosen file access is UTF-8 only, exposes no directory and saves atomically without late replacement', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-file-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const filename = path.join(directory, 'graph.jsonld')
  await writeFile(filename, 'Original')
  assert.deepEqual(await readChosenFile(filename, 'application/ld+json', () => true), { name: 'graph.jsonld', mediaType: 'application/ld+json', text: 'Original' })
  let checks = 0
  assert.deepEqual(await saveChosenFile(filename, { name: 'graph.jsonld', mediaType: 'application/ld+json', text: 'Late' }, () => ++checks === 1), { saved: false })
  assert.equal(await readFile(filename, 'utf8'), 'Original')
  assert.deepEqual(await saveChosenFile(filename, { name: 'graph.jsonld', mediaType: 'application/ld+json', text: 'Saved' }, () => true), { saved: true })
  assert.equal(await readFile(filename, 'utf8'), 'Saved')
  assert.deepEqual(await readdir(directory), ['graph.jsonld'])
  await writeFile(filename, new Uint8Array([0xff, 0xfe]))
  await assert.rejects(readChosenFile(filename, 'application/ld+json', () => true))
  await assert.rejects(readChosenFile(directory, 'text/plain', () => true))
})
