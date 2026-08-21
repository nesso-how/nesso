// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import en from './en'
import itLocale from './it'

const toolNames = [
  'getGraphOverview',
  'searchConcepts',
  'inspectConcept',
  'inspectRelation',
  'listNeighbors',
  'getRelationTypes',
]

describe('mentor tool action locale keys', () => {
  it('provides the same six transient actions in English and Italian', () => {
    expect(Object.keys(en.mentor.toolActions)).toEqual(toolNames)
    expect(Object.keys(itLocale.mentor.toolActions)).toEqual(toolNames)
  })

  it('uses concise action copy without exposing arguments or results', () => {
    expect(en.mentor.toolActions.searchConcepts).toBe('Searching concepts…')
    expect(en.mentor.toolActions.listNeighbors).toBe('Following relations…')
    expect(itLocale.mentor.toolActions.searchConcepts).toBe('Cerco concetti…')
    expect(itLocale.mentor.toolActions.listNeighbors).toBe('Seguo le relazioni…')
  })
})
