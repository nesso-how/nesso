import assert from 'node:assert/strict'
import test from 'node:test'
import { createPluginApproval } from './plugin-approval.ts'
import { preparePluginPackage } from '../packages/plugin/src/package.ts'
import type { InstalledPlugin, PluginAccess } from '../shared/plugins.ts'

const integrity = `sha512-${Buffer.alloc(64).toString('base64')}`
const make = async (
  version: string,
  access: PluginAccess = { writes: [], capabilities: [] },
): Promise<InstalledPlugin> => ({
  ...(await preparePluginPackage({
    manifest: {
      name: 'test-plugin',
      version,
      nesso: { apiVersion: 1, kind: 'actions', entry: 'index.js', ...access },
      i18n: {
        metadata: {
          name: { en: 'Test' },
          description: { en: 'Test plugin' },
          documentation: { en: 'Test documentation' },
        },
      },
    },
    files: [
      { path: 'index.js', bytes: new TextEncoder().encode(`export const version = '${version}'`) },
    ],
  })),
  enabled: false,
  npmIntegrity: integrity,
})

test('first installation requires one content-bound approval, even without declared effects', async () => {
  const received = await make('1.0.0')
  const approval = createPluginApproval(received, undefined, true)
  assert.ok(approval.challenge)
  assert.equal(approval.authorized(received, undefined), false)
  assert.equal(approval.respond('wrong', true), false)
  assert.equal(approval.respond(approval.challenge, 'true'), false)
  assert.equal(approval.respond(approval.challenge, true), true)
  assert.equal(approval.source, 'dialog')
  assert.equal(approval.respond(approval.challenge, true), false)
  assert.equal(approval.authorized(received, undefined), true)
  assert.equal(approval.authorized(await make('1.0.1'), undefined), false)
  assert.equal(approval.authorized(received, received), false)
  approval.revoke()
  assert.equal(approval.authorized(received, undefined), false)
})

test('unchanged and reduced verified npm access need no new prompt and retain only the new baseline', async () => {
  const previous = await make('1.0.0', { writes: ['concept.label'], capabilities: ['files'] })
  for (const access of [
    previous.nesso,
    { writes: [], capabilities: [] },
  ] satisfies PluginAccess[]) {
    const received = await make('1.1.0', access)
    const approval = createPluginApproval(received, previous, true)
    assert.equal(approval.challenge, undefined)
    assert.equal(approval.source, 'existing-access')
    assert.equal(approval.authorized(received, previous), true)
    assert.equal(approval.authorized(received, { ...previous, contentId: 'changed' }), false)
  }
  const reduced = await make('1.1.0')
  const reintroduced = createPluginApproval(
    await make('1.2.0', { writes: ['concept.label'], capabilities: [] }),
    reduced,
    true,
  )
  assert.ok(reintroduced.challenge)
  assert.deepEqual(reintroduced.access, { writes: ['concept.label'], capabilities: [] })
})

test('expansions list only additions; unknown provenance and development updates require full review', async () => {
  const previous = await make('1.0.0', { writes: ['concept.label'], capabilities: [] })
  const received = await make('1.1.0', { writes: ['concept.label'], capabilities: ['files'] })
  const expansion = createPluginApproval(received, previous, true)
  assert.equal(expansion.additional, true)
  assert.deepEqual(expansion.access, { writes: [], capabilities: ['files'] })
  assert.equal(expansion.authorized(received, previous), false)
  assert.equal(expansion.respond(expansion.challenge, false), true)
  assert.equal(expansion.respond(expansion.challenge, true), false)
  assert.equal(expansion.authorized(received, previous), false)
  for (const approval of [
    createPluginApproval(received, { ...previous, npmIntegrity: undefined }, true),
    createPluginApproval(received, previous, false),
  ]) {
    assert.equal(approval.additional, false)
    assert.deepEqual(approval.access, { writes: ['concept.label'], capabilities: ['files'] })
    assert.equal(approval.authorized(received, previous), false)
  }
})

test('stale, changed-kind, nonmatching, prerelease and non-newer npm targets are rejected', async () => {
  const previous = await make('1.0.0')
  const next = await make('1.1.0')
  for (const received of [
    previous,
    { ...next, name: 'other-plugin' },
    {
      ...next,
      nesso: {
        apiVersion: 1,
        kind: 'vocab',
        entry: 'definition.json',
        writes: [],
        capabilities: [],
      },
    } satisfies InstalledPlugin,
    await make('0.9.0'),
    await make('1.2.0-beta.1'),
  ]) {
    assert.throws(() => createPluginApproval(received, previous, true))
  }
  const routine = createPluginApproval(next, previous, true)
  assert.equal(routine.authorized(next, undefined), false)
  routine.revoke()
  assert.equal(routine.authorized(next, previous), false)
})

test('theme and vocabulary declarations use the same first-install and routine-update policy', async () => {
  const actions = await make('1.0.0')
  for (const kind of ['theme', 'vocab'] as const) {
    const previous: InstalledPlugin = {
      ...actions,
      nesso: { apiVersion: 1, kind, entry: 'definition.json', writes: [], capabilities: [] },
    }
    const received = { ...previous, version: '1.1.0', contentId: 'new-content' }
    assert.ok(createPluginApproval(received, undefined, true).challenge)
    const approval = createPluginApproval(received, previous, true)
    assert.equal(approval.challenge, undefined)
    assert.equal(approval.authorized(received, previous), true)
  }
})
