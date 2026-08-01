// SPDX-License-Identifier: MIT

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runNodeCli } from './test-cli-helper.mjs'
import { validateReleaseTag } from './validate-release-tag.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

// The CLI tests run main(), which reads the live repository versions, so derive
// the expected values from the same files instead of hardcoding a release.
function readJsonVersion(relativePath) {
  return JSON.parse(readFileSync(resolve(ROOT, relativePath), 'utf8')).version
}

const packageVersion = readJsonVersion('package.json')
const tauriVersion = readJsonVersion('src-tauri/tauri.conf.json')

describe('validateReleaseTag', () => {
  it('accepts the exact versioned tag ref', () => {
    expect(() =>
      validateReleaseTag(`refs/tags/v${packageVersion}`, packageVersion, tauriVersion),
    ).not.toThrow()
  })

  it('rejects drift between package.json and the Tauri config version', () => {
    expect(() => validateReleaseTag('refs/tags/v0.0.0', '0.0.0', '0.0.1')).toThrow(
      'release version drift: package.json is "0.0.0" but src-tauri/tauri.conf.json is "0.0.1"',
    )
  })

  it('rejects a tag whose version differs from package.json', () => {
    expect(() => validateReleaseTag('refs/tags/v0.0.0', packageVersion, tauriVersion)).toThrow(
      `release tag/version mismatch: expected "refs/tags/v${packageVersion}", received "refs/tags/v0.0.0"`,
    )
  })

  it.each([
    'refs/heads/main',
    'refs/tags/0.2.0-beta.0',
    'refs/tags/v0.2.0-beta.0/extra',
    'v0.2.0-beta.0',
  ])('rejects non-release ref %s', (ref) => {
    expect(() => validateReleaseTag(ref, packageVersion, tauriVersion)).toThrow(
      `release requires an exact refs/tags/v* ref; received "${ref}"`,
    )
  })

  it('rejects a missing ref', () => {
    expect(() => validateReleaseTag(undefined, packageVersion, tauriVersion)).toThrow(
      'release requires an exact refs/tags/v* ref; received ""',
    )
  })

  it('rejects a missing repository version', () => {
    expect(() => validateReleaseTag('refs/tags/v0.0.0', undefined, tauriVersion)).toThrow(
      'package.json must contain a non-empty string version',
    )
  })

  it('rejects a missing Tauri version', () => {
    expect(() => validateReleaseTag('refs/tags/v0.0.0', packageVersion, undefined)).toThrow(
      'src-tauri/tauri.conf.json must contain a non-empty string version',
    )
  })
})

describe('validate-release-tag CLI', () => {
  it('loads repository versions and reports a successful release', () => {
    const tag = `refs/tags/v${packageVersion}`
    const result = runNodeCli(new URL('./validate-release-tag.mjs', import.meta.url), {
      env: { GITHUB_REF: tag },
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toBe(
      `Release tag matches package.json and src-tauri/tauri.conf.json versions: ${tag}\n`,
    )
    expect(result.stderr).toBe('')
  })

  it('fails closed with diagnostics when the release ref does not match', () => {
    const result = runNodeCli(new URL('./validate-release-tag.mjs', import.meta.url), {
      env: { GITHUB_REF: 'refs/tags/v0.0.0' },
    })

    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe(
      `release-tag: release tag/version mismatch: expected "refs/tags/v${packageVersion}", received "refs/tags/v0.0.0"\n`,
    )
  })
})
