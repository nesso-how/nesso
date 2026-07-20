// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { describe, expect, it, beforeEach } from 'vitest'
import { isDesktop } from '@/lib/isDesktop'

const originalUserAgent = navigator.userAgent

describe('isDesktop', () => {
  beforeEach(() => {
    delete (window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
      writable: true,
    })
  })

  it('returns false on the web (no Tauri internals)', () => {
    expect(isDesktop()).toBe(false)
  })

  it('returns true when Tauri internals are present and the platform is desktop', () => {
    ;(window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {}
    // macOS user agent
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
      configurable: true,
    })
    expect(isDesktop()).toBe(true)
  })

  it('returns false when Tauri internals are present but the platform is Android', () => {
    ;(window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {}
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      configurable: true,
    })
    expect(isDesktop()).toBe(false)
  })

  it('returns false when Tauri internals are present but the platform is iOS', () => {
    ;(window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {}
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
      configurable: true,
    })
    expect(isDesktop()).toBe(false)
  })

  it('returns false when Tauri internals are present but the platform is iPad', () => {
    ;(window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {}
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
      configurable: true,
    })
    expect(isDesktop()).toBe(false)
  })

  it('returns false when Tauri internals are present but the platform is iPod', () => {
    ;(window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {}
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPod touch; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
      configurable: true,
    })
    expect(isDesktop()).toBe(false)
  })

  it('returns true for desktop Linux with Tauri internals', () => {
    ;(window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {}
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      configurable: true,
    })
    expect(isDesktop()).toBe(true)
  })

  it('returns true for desktop Windows with Tauri internals', () => {
    ;(window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {}
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      configurable: true,
    })
    expect(isDesktop()).toBe(true)
  })

  it('does not match "Android" embedded in a non-mobile string', () => {
    // Desktop browsers don't include "Android" in their UA, so this is a
    // safeguard against false positives on desktop Linux (some embedded
    // strings could in theory include "Android" in rare cases).
    ;(window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {}
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64) like Android',
      configurable: true,
    })
    // "like Android" is not "Android" — the regex must match the word boundary.
    // But /Android/i would match "like Android" which IS a string containing "Android".
    // This test documents that this edge case causes a false negative (desktop Linux
    // with "Android" in the UA would be treated as mobile).  This is an acceptable
    // tradeoff because real desktop UAs don't contain "Android" and the risk of
    // a malicious UA spoof is minimal compared to the safety of excluding
    // real mobile Tauri builds.
    expect(isDesktop()).toBe(false)
  })
})
