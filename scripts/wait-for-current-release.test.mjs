// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from 'vitest'
import { waitForCurrentRelease } from './wait-for-current-release.mjs'

describe('waitForCurrentRelease', () => {
  it('polls through release propagation lag before accepting the current tag', async () => {
    const getLatestTag = vi
      .fn()
      .mockResolvedValueOnce('v0.2.0-beta.1')
      .mockResolvedValueOnce('v0.2.0-beta.0')
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      waitForCurrentRelease('refs/tags/v0.2.0-beta.0', getLatestTag, {
        maxAttempts: 2,
        delayMs: 250,
        sleep,
      }),
    ).resolves.toBe('v0.2.0-beta.0')

    expect(getLatestTag).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledOnce()
    expect(sleep).toHaveBeenCalledWith(250)
  })

  it('fails closed after the bounded retry budget', async () => {
    const getLatestTag = vi.fn().mockRejectedValue(new Error('GitHub API unavailable'))
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      waitForCurrentRelease('refs/tags/v0.2.0-beta.0', getLatestTag, {
        maxAttempts: 3,
        delayMs: 250,
        sleep,
      }),
    ).rejects.toThrow('current release check failed after 3 attempts: GitHub API unavailable')

    expect(getLatestTag).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })
})
