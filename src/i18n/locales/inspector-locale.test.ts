// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import en from './en'
import itLocale from './it'

describe('inspector locale keys (definition-only)', () => {
  it('inspector.notes has only definition and definitionPlaceholder', () => {
    const allowed = ['definition', 'definitionPlaceholder']
    const actual = Object.keys(en.inspector.notes)
    expect(actual.sort()).toEqual(allowed.sort())
  })

  it('inspector has no image key', () => {
    expect(en.inspector).not.toHaveProperty('image')
  })

  it('Italian locale matches English structure', () => {
    const allowed = ['definition', 'definitionPlaceholder']
    const actual = Object.keys(itLocale.inspector.notes)
    expect(actual.sort()).toEqual(allowed.sort())
    expect(itLocale.inspector).not.toHaveProperty('image')
  })
})
