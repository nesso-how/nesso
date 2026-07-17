// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest'
import { toCountBucket } from './index'

describe('toCountBucket', () => {
  it('returns "0" for count 0', () => {
    expect(toCountBucket(0)).toBe('0')
  })

  it('returns "1-2" for count 1', () => {
    expect(toCountBucket(1)).toBe('1-2')
  })

  it('returns "1-2" for count 2', () => {
    expect(toCountBucket(2)).toBe('1-2')
  })

  it('returns "3-5" for count 3', () => {
    expect(toCountBucket(3)).toBe('3-5')
  })

  it('returns "3-5" for count 5', () => {
    expect(toCountBucket(5)).toBe('3-5')
  })

  it('returns "6-10" for count 6', () => {
    expect(toCountBucket(6)).toBe('6-10')
  })

  it('returns "6-10" for count 10', () => {
    expect(toCountBucket(10)).toBe('6-10')
  })

  it('returns "11+" for count 11', () => {
    expect(toCountBucket(11)).toBe('11+')
  })

  it('returns "11+" for count 100', () => {
    expect(toCountBucket(100)).toBe('11+')
  })

  it('treats negative counts as "0"', () => {
    expect(toCountBucket(-1)).toBe('0')
  })
})
