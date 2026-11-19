import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { valid } from 'semver'
import { releaseHighlights } from '../../shared/whats-new.ts'
import { selectReleaseNotes } from './catalog.ts'

test('bundled notes have exact version filenames and matching highlights in every app language', () => {
  const directory = new URL('./notes/', import.meta.url)
  for (const file of readdirSync(directory).filter((entry) => entry.endsWith('.json'))) {
    const version = file.slice(0, -5)
    assert.equal(valid(version), version, file)
    const notes = releaseHighlights.safeParse(
      JSON.parse(readFileSync(new URL(file, directory), 'utf8')),
    )
    assert.ok(notes.success, `${file}: ${notes.error?.message ?? ''}`)
  }
})

test('notes include skipped releases in version order, but never future or already launched releases', () => {
  const messages = { en: ['New'], it: ['Novità'], 'zh-CN': ['更新内容'] }
  const files = Object.fromEntries(
    ['0.9.0', '1.0.0-beta.8', '1.0.0-beta.9', '1.0.0-beta.10', '1.0.0', '1.1.0', '1.2.0'].map(
      (version) => [`./notes/${version}.json`, messages],
    ),
  )
  const versions = (current: string, previous?: string) =>
    selectReleaseNotes(files, current, previous).map(({ version }) => version)
  assert.deepEqual(versions('1.0.0', '1.0.0-beta.8'), ['1.0.0', '1.0.0-beta.10', '1.0.0-beta.9'])
  assert.deepEqual(versions('1.1.0', '0.9.0'), ['1.1.0', '1.0.0'])
  assert.deepEqual(versions('1.0.0'), [
    '1.0.0',
    '1.0.0-beta.10',
    '1.0.0-beta.9',
    '1.0.0-beta.8',
    '0.9.0',
  ])
})
