// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en'
import { buildSnippets } from './registry'

describe('buildSnippets', () => {
  const snippets = buildSnippets(en.writing.snippets)

  it('exposes the built-in v1 set with the SnippetDefinition shape', () => {
    expect(snippets.map((s) => s.id)).toEqual([
      'heading-2',
      'heading-3',
      'bullet-list',
      'ordered-list',
      'blockquote',
      'divider',
      'callout',
      'example',
    ])
    for (const s of snippets) {
      expect(typeof s.label).toBe('string')
      expect(typeof s.description).toBe('string')
      expect(typeof s.icon).toBe('string')
      expect(typeof s.command).toBe('function')
    }
  })

  it('snippet commands drive the editor chain focus → method → run', () => {
    // Recording stub: every chain method is recorded and returns the stub, so
    // each command's exact chain sequence is verified without a real editor.
    const expectedChains: Record<string, string[]> = {
      'heading-2': ['focus', 'toggleHeading', 'run'],
      'heading-3': ['focus', 'toggleHeading', 'run'],
      'bullet-list': ['focus', 'toggleBulletList', 'run'],
      'ordered-list': ['focus', 'toggleOrderedList', 'run'],
      blockquote: ['focus', 'toggleBlockquote', 'run'],
      divider: ['focus', 'setHorizontalRule', 'run'],
      callout: ['focus', 'setCallout', 'run'],
      example: ['focus', 'setExample', 'run'],
    }
    for (const snippet of snippets) {
      const calls: Array<{ method: string; args: unknown[] }> = []
      const stub = new Proxy<Record<string, unknown>>(
        {},
        {
          get: (_target, property) => {
            const method = String(property)
            return (...args: unknown[]) => {
              calls.push({ method, args })
              return stub
            }
          },
        },
      )
      snippet.command({ chain: () => stub } as never)
      expect(calls.map((c) => c.method)).toEqual(expectedChains[snippet.id])
      if (snippet.id === 'heading-2') {
        expect(calls.find((c) => c.method === 'toggleHeading')?.args).toEqual([{ level: 2 }])
      }
      if (snippet.id === 'heading-3') {
        expect(calls.find((c) => c.method === 'toggleHeading')?.args).toEqual([{ level: 3 }])
      }
    }
  })
})
