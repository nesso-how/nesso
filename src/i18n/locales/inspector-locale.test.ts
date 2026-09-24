// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import en from './en'
import itLocale from './it'

describe('inspector locale keys (definition + notes section)', () => {
  const notesKeys = [
    'definition',
    'definitionPlaceholder',
    'section',
    'write',
    'elaboration',
    'openNote',
  ]

  it('inspector.notes has the elaboration-section keys (no preview empty state)', () => {
    const actual = Object.keys(en.inspector.notes)
    expect(actual.sort()).toEqual([...notesKeys].sort())
  })

  it('inspector has no image key', () => {
    expect(en.inspector).not.toHaveProperty('image')
  })

  it('Italian locale matches English structure', () => {
    const actual = Object.keys(itLocale.inspector.notes)
    expect(actual.sort()).toEqual([...notesKeys].sort())
    expect(itLocale.inspector).not.toHaveProperty('image')
  })

  it('writing snippet keys match between locales', () => {
    expect(Object.keys(itLocale.writing.snippets).sort()).toEqual(
      Object.keys(en.writing.snippets).sort(),
    )
  })

  it('writing has a stable snippetsMenu label and no pill/word-count keys', () => {
    expect(Object.keys(en.writing)).not.toContain('pill')
    expect(Object.keys(en.writing)).not.toContain('words')
    expect(typeof en.writing.snippetsMenu).toBe('string')
    expect(typeof itLocale.writing.snippetsMenu).toBe('string')
  })
})
