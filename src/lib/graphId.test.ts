// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { isGraphId, newElementId, newGraphId } from './graphId'

describe('newGraphId', () => {
  it('produces a `g` + 13 lowercase-alphanumeric id', () => {
    for (let i = 0; i < 50; i++) {
      const id = newGraphId()
      expect(id).toMatch(/^g[a-z0-9]{13}$/)
      expect(isGraphId(id)).toBe(true)
    }
  })

  it('is overwhelmingly unique across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newGraphId()))
    expect(ids.size).toBe(1000)
  })
})

describe('isGraphId', () => {
  it('rejects malformed ids', () => {
    expect(isGraphId('')).toBe(false)
    expect(isGraphId('g')).toBe(false)
    expect(isGraphId('xabcdefghijklm')).toBe(false) // wrong prefix
    expect(isGraphId('gABCDEFGHIJKLM')).toBe(false) // uppercase
    expect(isGraphId('gabc')).toBe(false) // too short
    expect(isGraphId('gabcdefghijklmn')).toBe(false) // too long
  })
})

describe('newElementId', () => {
  it('prefixes node and edge ids and stays out of the used set', () => {
    const node = newElementId('n', new Set())
    expect(node).toMatch(/^n[a-z0-9]{5}$/)
    const edge = newElementId('e', new Set())
    expect(edge).toMatch(/^e[a-z0-9]{5}$/)
  })

  it('never returns an id already present in the used set', () => {
    const used = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const id = newElementId('n', used)
      expect(used.has(id)).toBe(false)
      used.add(id)
    }
    expect(used.size).toBe(200)
  })
})
