// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { resolvePreventScrolling } from './NessoGraph.js'

describe('resolvePreventScrolling', () => {
  it('blocks page scroll when wheel zoom is on', () => {
    expect(resolvePreventScrolling(true)).toBe(true)
  })

  it('allows page scroll when wheel zoom and pan-on-scroll are off', () => {
    expect(resolvePreventScrolling(false)).toBe(false)
    expect(resolvePreventScrolling(false, { panOnScroll: false })).toBe(false)
  })

  it('blocks page scroll when pan-on-scroll is on', () => {
    expect(resolvePreventScrolling(false, { panOnScroll: true })).toBe(true)
  })

  it('honours an explicit override', () => {
    expect(resolvePreventScrolling(true, { preventScrolling: false })).toBe(false)
    expect(resolvePreventScrolling(false, { preventScrolling: true })).toBe(true)
  })
})
