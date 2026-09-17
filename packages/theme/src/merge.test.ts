// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { deepMerge } from './merge.js'

describe('deepMerge', () => {
  it('returns non-object overrides verbatim', () => {
    expect(deepMerge({ a: 1 }, 'scalar' as never)).toBe('scalar')
    expect(deepMerge({ a: 1 }, [1, 2] as never)).toEqual([1, 2])
  })

  it('returns the base when the override is undefined or null', () => {
    expect(deepMerge({ a: 1 }, undefined as never)).toEqual({ a: 1 })
    expect(deepMerge({ a: 1 }, null as never)).toEqual({ a: 1 })
  })

  it('returns the override when the base is not a plain object', () => {
    expect(deepMerge('base' as never, { a: 1 } as never)).toEqual({ a: 1 })
  })
})
