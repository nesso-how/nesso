// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { runNodeCli } from './test-cli-helper.mjs'
import { validateReleaseTag } from './validate-release-tag.mjs'

describe('validateReleaseTag', () => {
  it('accepts the exact versioned tag ref', () => {
    expect(() =>
      validateReleaseTag('refs/tags/v0.2.0-beta.0', '0.2.0-beta.0', '0.2.0-beta.0'),
    ).not.toThrow()
  })

  it('rejects drift between package.json and the Tauri config version', () => {
    expect(() =>
      validateReleaseTag('refs/tags/v0.2.0-beta.0', '0.2.0-beta.0', '0.2.0-beta.1'),
    ).toThrow(
      'release version drift: package.json is "0.2.0-beta.0" but src-tauri/tauri.conf.json is "0.2.0-beta.1"',
    )
  })

  it('rejects a tag whose version differs from package.json', () => {
    expect(() =>
      validateReleaseTag('refs/tags/v0.2.0-beta.1', '0.2.0-beta.0', '0.2.0-beta.0'),
    ).toThrow(
      'release tag/version mismatch: expected "refs/tags/v0.2.0-beta.0", received "refs/tags/v0.2.0-beta.1"',
    )
  })

  it.each([
    'refs/heads/main',
    'refs/tags/0.2.0-beta.0',
    'refs/tags/v0.2.0-beta.0/extra',
    'v0.2.0-beta.0',
  ])('rejects non-release ref %s', (ref) => {
    expect(() => validateReleaseTag(ref, '0.2.0-beta.0', '0.2.0-beta.0')).toThrow(
      `release requires an exact refs/tags/v* ref; received "${ref}"`,
    )
  })

  it('rejects a missing ref', () => {
    expect(() => validateReleaseTag(undefined, '0.2.0-beta.0', '0.2.0-beta.0')).toThrow(
      'release requires an exact refs/tags/v* ref; received ""',
    )
  })

  it('rejects a missing repository version', () => {
    expect(() => validateReleaseTag('refs/tags/v0.2.0-beta.0', undefined, '0.2.0-beta.0')).toThrow(
      'package.json must contain a non-empty string version',
    )
  })

  it('rejects a missing Tauri version', () => {
    expect(() => validateReleaseTag('refs/tags/v0.2.0-beta.0', '0.2.0-beta.0', undefined)).toThrow(
      'src-tauri/tauri.conf.json must contain a non-empty string version',
    )
  })
})

describe('validate-release-tag CLI', () => {
  it('loads repository versions and reports a successful release', () => {
    const result = runNodeCli(new URL('./validate-release-tag.mjs', import.meta.url), {
      env: { GITHUB_REF: 'refs/tags/v0.2.0-beta.0' },
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toBe(
      'Release tag matches package.json and src-tauri/tauri.conf.json versions: refs/tags/v0.2.0-beta.0\n',
    )
    expect(result.stderr).toBe('')
  })

  it('fails closed with diagnostics when the release ref does not match', () => {
    const result = runNodeCli(new URL('./validate-release-tag.mjs', import.meta.url), {
      env: { GITHUB_REF: 'refs/tags/v0.2.0-beta.1' },
    })

    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe(
      'release-tag: release tag/version mismatch: expected "refs/tags/v0.2.0-beta.0", received "refs/tags/v0.2.0-beta.1"\n',
    )
  })
})
