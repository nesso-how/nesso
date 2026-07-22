// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { runNodeCli } from './test-cli-helper.mjs'
import { validateCurrentRelease } from './validate-current-release.mjs'

describe('validateCurrentRelease', () => {
  it('accepts a retry of the currently latest released tag', () => {
    expect(() => validateCurrentRelease('refs/tags/v0.3.0', 'v0.3.0')).not.toThrow()
  })

  it('rejects an older release when a newer release is latest', () => {
    expect(() => validateCurrentRelease('refs/tags/v0.2.0', 'v0.3.0')).toThrow(
      'stale release: refs/tags/v0.2.0 is not the latest released tag; latest is v0.3.0',
    )
  })

  it.each([
    [undefined, 'v0.3.0'],
    ['refs/heads/main', 'v0.3.0'],
    ['refs/tags/v0.3.0', undefined],
    ['refs/tags/v0.3.0', 'not-a-tag'],
  ])('fails closed for invalid release signal (%s, %s)', (ref, latestTag) => {
    expect(() => validateCurrentRelease(ref, latestTag)).toThrow()
  })
})

describe('validate-current-release CLI', () => {
  it('uses the workflow ref and latest-release input', () => {
    const result = runNodeCli(new URL('./validate-current-release.mjs', import.meta.url), {
      env: { GITHUB_REF: 'refs/tags/v0.3.0' },
      input: 'v0.3.0\n',
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('Release is the latest released tag: v0.3.0\n')
    expect(result.stderr).toBe('')
  })

  it('fails closed when the authoritative signal is stale', () => {
    const result = runNodeCli(new URL('./validate-current-release.mjs', import.meta.url), {
      env: { GITHUB_REF: 'refs/tags/v0.2.0' },
      input: 'v0.3.0\n',
    })

    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe(
      'current-release: stale release: refs/tags/v0.2.0 is not the latest released tag; latest is v0.3.0\n',
    )
  })
})
