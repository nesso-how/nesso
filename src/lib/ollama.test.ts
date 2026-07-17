// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import type { OllamaModelStatus } from './ollama'
import { ollamaNativeBase, isLocalhostUrl } from './ollama'

describe('ollamaNativeBase', () => {
  it('strips trailing slashes', () => {
    expect(ollamaNativeBase('http://localhost:11434/v1/')).toBe('http://localhost:11434')
    expect(ollamaNativeBase('http://localhost:11434/')).toBe('http://localhost:11434')
  })

  it('strips /v1 suffix and trailing slashes together', () => {
    expect(ollamaNativeBase('http://localhost:11434/v1')).toBe('http://localhost:11434')
  })

  it('keeps the URL unchanged if there is no /v1 suffix', () => {
    expect(ollamaNativeBase('http://localhost:11434')).toBe('http://localhost:11434')
  })

  it('strips only the final /v1, not an embedded one', () => {
    expect(ollamaNativeBase('http://localhost:11434/some/v1/path/v1')).toBe(
      'http://localhost:11434/some/v1/path',
    )
  })
})

// re-export smoke test — full coverage lives in src/llm/completion.test.ts
describe('isLocalhostUrl (re-export)', () => {
  it('recognizes localhost as local', () => {
    expect(isLocalhostUrl('http://localhost:11434/v1')).toBe(true)
  })

  it('rejects a non-local URL', () => {
    expect(isLocalhostUrl('https://opencode.ai/zen/v1')).toBe(false)
  })
})
