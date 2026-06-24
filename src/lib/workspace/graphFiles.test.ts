// SPDX-License-Identifier: MIT
import { deserialize, GRAPH_FORMAT_VERSION } from '@nesso-how/schema'
import { VOCABULARY } from '@nesso-how/vocab-learning'
import { describe, expect, it } from 'vitest'
import type { GraphRecord } from '@/store/db'
import { defaultConceptReviewFields } from '@/types/graph'
import {
  filenameBaseFromName,
  graphNameFromFilename,
  recordToGraphFile,
  uniqueGraphNameAmong,
} from './graphFiles'

describe('filenameBaseFromName', () => {
  it('keeps spaces but strips path-forbidden characters', () => {
    expect(filenameBaseFromName('My Graph')).toBe('My Graph')
    expect(filenameBaseFromName('a/b:c|d')).toBe('a-b-c-d')
    expect(filenameBaseFromName('  trimmed  ')).toBe('trimmed')
  })

  it('falls back to `graph` only when the result would be empty', () => {
    expect(filenameBaseFromName('')).toBe('graph')
    expect(filenameBaseFromName('   ')).toBe('graph')
    // All-forbidden chars become dashes, which is non-empty, so no fallback.
    expect(filenameBaseFromName('???')).toBe('---')
  })
})

describe('graphNameFromFilename', () => {
  it('drops the .json extension case-insensitively', () => {
    expect(graphNameFromFilename('Foo.json')).toBe('Foo')
    expect(graphNameFromFilename('Foo.JSON')).toBe('Foo')
    expect(graphNameFromFilename('No extension')).toBe('No extension')
  })

  it('falls back to Untitled for an empty stem', () => {
    expect(graphNameFromFilename('.json')).toBe('Untitled')
  })

  it('trims surrounding whitespace from the stem', () => {
    expect(graphNameFromFilename(' Spaced .json')).toBe('Spaced')
  })
})

describe('uniqueGraphNameAmong', () => {
  it('returns the name unchanged when it is free', () => {
    expect(uniqueGraphNameAmong('Foo', [])).toBe('Foo')
    expect(uniqueGraphNameAmong('Foo', ['Bar'])).toBe('Foo')
  })

  it('suffixes with the first free -N, case-insensitively', () => {
    expect(uniqueGraphNameAmong('Foo', ['Foo'])).toBe('Foo-2')
    expect(uniqueGraphNameAmong('Foo', ['foo', 'Foo-2'])).toBe('Foo-3')
  })

  it('defaults a blank name to `graph`', () => {
    expect(uniqueGraphNameAmong('   ', [])).toBe('graph')
  })

  it('matches used names after trimming whitespace', () => {
    expect(uniqueGraphNameAmong('Foo', [' foo '])).toBe('Foo-2')
  })
})

describe('recordToGraphFile', () => {
  const record: GraphRecord = {
    id: 'g0000000000001',
    name: 'Demo',
    createdAt: 1,
    updatedAt: 42,
    nodes: [
      {
        id: 'n1',
        position: { x: 0, y: 0 },
        selected: true,
        data: { text: 'A', ...defaultConceptReviewFields() },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'n1',
        target: 'n1',
        type: 'nesso',
        selected: true,
        data: { type: 'causes' },
      },
    ],
  }

  it('serializes to a deserializable Nesso graph document carrying id, name and updatedAt', () => {
    const parsed = deserialize(recordToGraphFile(record))
    expect(parsed).toMatchObject({
      version: GRAPH_FORMAT_VERSION,
      vocabulary: { id: VOCABULARY.id, version: VOCABULARY.version },
      id: 'g0000000000001',
      name: 'Demo',
      updatedAt: 42,
    })
    expect(parsed.concepts).toHaveLength(1)
    expect(parsed.relations).toHaveLength(1)
  })

  it('omits FSRS fields from serialized concept content', () => {
    const parsed = deserialize(recordToGraphFile(record))
    expect(parsed.concepts[0]).toMatchObject({ id: 'n1', label: 'A', x: 0, y: 0 })
    expect(parsed.concepts[0].data?.elaboration).toBeUndefined()
  })
})
