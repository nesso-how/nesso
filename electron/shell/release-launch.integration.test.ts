import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { type TestContext } from 'node:test'
import { recordReleaseLaunch } from './release-launch.ts'

async function fixture(context: TestContext) {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-release-launch-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const file = path.join(directory, 'latest-launched-version.txt')
  return { file, launch: (version: string) => recordReleaseLaunch(directory, version) }
}

test('only a launch of a higher version returns the previously recorded version', async (context) => {
  const { launch } = await fixture(context)
  assert.equal(await launch('1.0.0-beta.9'), undefined)
  assert.equal(await launch('1.0.0-beta.10'), '1.0.0-beta.9')
  assert.equal(await launch('1.0.0-beta.10'), undefined)
  assert.equal(await launch('1.0.0-beta.9'), undefined)
  assert.equal(await launch('1.0.0'), '1.0.0-beta.10')
})

test('an invalid launch record does not block startup or get overwritten', async (context) => {
  const { file, launch } = await fixture(context)
  context.mock.method(console, 'error', () => {})
  await writeFile(file, 'unknown')
  assert.equal(await launch('2.0.0'), undefined)
  assert.equal(await readFile(file, 'utf8'), 'unknown')
})
