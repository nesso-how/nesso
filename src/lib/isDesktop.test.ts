// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { isDesktop } from '@/lib/isDesktop'

const setTauri = (present: boolean) => {
  if (present) {
    ;(window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {}
  } else {
    delete (window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__
  }
}

const setUA = (ua: string) => {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true, writable: true })
}

describe('isDesktop', () => {
  it('returns false on the web (no Tauri internals)', () => {
    setTauri(false)
    expect(isDesktop()).toBe(false)
  })

  describe.each([
    [
      'macOS',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
    ],
    [
      'Linux',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ],
    [
      'Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ],
  ])('desktop %s', (_, ua) => {
    it('returns true when Tauri internals are present', () => {
      setTauri(true)
      setUA(ua)
      expect(isDesktop()).toBe(true)
    })
  })

  describe.each([
    [
      'Android',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    ],
    [
      'iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
    ],
    [
      'iPad',
      'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
    ],
    [
      'iPod',
      'Mozilla/5.0 (iPod touch; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
    ],
  ])('mobile %s', (_, ua) => {
    it('returns false even when Tauri internals are present', () => {
      setTauri(true)
      setUA(ua)
      expect(isDesktop()).toBe(false)
    })
  })

  it('does not match "Android" embedded in a non-mobile string', () => {
    setTauri(true)
    setUA('Mozilla/5.0 (X11; Linux x86_64) like Android')
    expect(isDesktop()).toBe(false)
  })
})
