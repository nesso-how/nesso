// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { pickDisplay } from './display.js'

describe('pickDisplay', () => {
  it('prefers the explicit prop over document and fallback', () => {
    expect(pickDisplay('minimal' as const, 'full' as const, 'full' as const)).toBe('minimal')
  })

  it('falls back to the document display when the prop is undefined', () => {
    expect(pickDisplay(undefined, 'category' as const, 'full' as const)).toBe('category')
  })

  it('falls back to the built-in default when both are undefined', () => {
    expect(pickDisplay(undefined, undefined, true)).toBe(true)
  })

  it('preserves an explicit false rather than falling through', () => {
    expect(pickDisplay(false, true, true)).toBe(false)
  })
})
