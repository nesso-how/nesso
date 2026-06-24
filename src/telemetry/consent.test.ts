// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { ZUSTAND_PERSIST_KEY } from '@/data/storageKeys'
import { readTelemetryConsent } from './consent'

describe('readTelemetryConsent', () => {
  afterEach(() => {
    localStorage.removeItem(ZUSTAND_PERSIST_KEY)
  })

  it('returns false when nothing is persisted', () => {
    expect(readTelemetryConsent()).toBe(false)
  })

  it('returns false when telemetry is absent or false', () => {
    localStorage.setItem(
      ZUSTAND_PERSIST_KEY,
      JSON.stringify({ state: { settings: { telemetry: false } } }),
    )
    expect(readTelemetryConsent()).toBe(false)
  })

  it('returns true only when telemetry is explicitly true', () => {
    localStorage.setItem(
      ZUSTAND_PERSIST_KEY,
      JSON.stringify({ state: { settings: { telemetry: true } } }),
    )
    expect(readTelemetryConsent()).toBe(true)
  })

  it('returns false on malformed JSON', () => {
    localStorage.setItem(ZUSTAND_PERSIST_KEY, '{not json')
    expect(readTelemetryConsent()).toBe(false)
  })
})
