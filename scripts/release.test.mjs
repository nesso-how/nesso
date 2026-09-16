// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { nextVersion } from './release.mjs'

describe('release version selection', () => {
  it('increments alpha and beta prerelease counters', () => {
    expect(nextVersion('0.1.0-alpha.41')).toBe('0.1.0-alpha.42')
    expect(nextVersion('0.2.0-beta.5')).toBe('0.2.0-beta.6')
    expect(nextVersion('1.0.0-rc.9')).toBe('1.0.0-rc.10')
  })

  it('keeps an explicit version unchanged', () => {
    expect(nextVersion('0.2.0-beta.5', '0.2.0')).toBe('0.2.0')
  })

  it('rejects versions without a numeric prerelease counter', () => {
    expect(() => nextVersion('0.2.0')).toThrow('not a numbered prerelease')
  })
})
