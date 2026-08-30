// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import en from './en'
import itLocale from './it'

describe('inspector locale keys (definition + notes section)', () => {
  it('inspector.notes has definition, placeholder, section, empty, and write', () => {
    const allowed = ['definition', 'definitionPlaceholder', 'section', 'empty', 'write']
    const actual = Object.keys(en.inspector.notes)
    expect(actual.sort()).toEqual(allowed.sort())
  })

  it('inspector has no image key', () => {
    expect(en.inspector).not.toHaveProperty('image')
  })

  it('Italian locale matches English structure', () => {
    const allowed = ['definition', 'definitionPlaceholder', 'section', 'empty', 'write']
    const actual = Object.keys(itLocale.inspector.notes)
    expect(actual.sort()).toEqual(allowed.sort())
    expect(itLocale.inspector).not.toHaveProperty('image')
  })

  it('writing snippet keys match between locales', () => {
    expect(Object.keys(itLocale.writing.snippets).sort()).toEqual(
      Object.keys(en.writing.snippets).sort(),
    )
  })
})
