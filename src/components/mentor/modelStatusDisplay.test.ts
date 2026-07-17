// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { getErrorHint } from './modelStatusDisplay'

describe('getErrorHint', () => {
  it('returns unreachable for non-local URLs', () => {
    expect(getErrorHint('https://opencode.ai/zen/v1', false, 'localhost')).toBe('unreachable')
    expect(getErrorHint('https://api.openai.com/v1', true, 'localhost')).toBe('unreachable')
  })

  it('returns ollama-not-running on desktop for any local URL', () => {
    // Desktop: never CORS — native HTTP transport.
    expect(getErrorHint('http://localhost:11434/v1', true, 'localhost')).toBe('ollama-not-running')
    expect(getErrorHint('http://localhost:11434/v1', true, 'app.nesso.how')).toBe(
      'ollama-not-running',
    )
    expect(getErrorHint('http://127.0.0.1:11434/v1', true, 'app.nesso.how')).toBe(
      'ollama-not-running',
    )
    expect(getErrorHint('http://[::1]:11434/v1', true, 'app.nesso.how')).toBe('ollama-not-running')
  })

  it('returns ollama-not-running on browser when app and endpoint are on the same loopback', () => {
    expect(getErrorHint('http://localhost:11434/v1', false, 'localhost')).toBe('ollama-not-running')
    expect(getErrorHint('http://127.0.0.1:11434/v1', false, '127.0.0.1')).toBe('ollama-not-running')
    expect(getErrorHint('http://127.0.0.1:11434', false, 'localhost')).toBe('ollama-not-running')
  })

  it('returns cors-blocked on browser when app and endpoint differ', () => {
    // Browser served from https://app.nesso.how, pointing at local Ollama.
    expect(getErrorHint('http://localhost:11434/v1', false, 'app.nesso.how')).toBe('cors-blocked')
    expect(getErrorHint('http://127.0.0.1:11434', false, 'app.nesso.how')).toBe('cors-blocked')
    expect(getErrorHint('http://[::1]:11434/v1', false, 'nesso.local')).toBe('cors-blocked')
  })

  it('handles invalid base URLs gracefully by falling back to cors-blocked on browser', () => {
    // Unparseable local URL on browser — treat as CORS blocked.
    expect(getErrorHint('not-a-url', false, 'app.nesso.how')).toBe('unreachable')
  })
})
