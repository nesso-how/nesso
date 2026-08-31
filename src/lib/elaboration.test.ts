// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import type { NotesDocument } from '@/types/graph'
import { withDefinition } from './elaboration'

describe('withDefinition', () => {
  it('preserves existing notes when the definition is edited', () => {
    const notes: NotesDocument = { type: 'doc', content: [] }
    expect(withDefinition({ definition: 'old', notes }, 'new')).toEqual({
      definition: 'new',
      notes,
    })
  })

  it('omits notes entirely when none exist (no undefined-value litter)', () => {
    expect(withDefinition({ definition: 'old' }, 'new')).toEqual({ definition: 'new' })
    expect(withDefinition(undefined, 'new')).toEqual({ definition: 'new' })
  })
})
