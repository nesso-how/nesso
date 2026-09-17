// @vitest-environment jsdom
// SPDX-License-Identifier: MIT

import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelStatus } from '@/lib/ollama'

// Minimal i18n stub — avoids the persisted store.
vi.mock('@/i18n', () => ({
  useT: () => ({
    settings: {
      ai: {
        pulling: (model: string, pct: number) => `Pulling ${model}… ${pct}%`,
        status: {
          checking: 'Checking…',
          available: 'Available',
          notFound: 'Not found locally',
          modelNotFound: 'Model not found',
          pull: 'Pull',
          ollamaNotRunning: 'Ollama not running:',
          corsBlocked: 'CORS blocked. Set',
          unauthorized: 'Unauthorized',
          unreachable: 'API unreachable',
        },
      },
    },
  }),
}))

import { ModelStatusBadge } from './ModelStatusBadge'

let root: Root | null = null
let container: HTMLDivElement | null = null

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  if (root) {
    root.unmount()
    root = null
  }
  if (container) {
    container.remove()
    container = null
  }
})

function render(
  status: ModelStatus,
  baseUrl = 'http://localhost:11434',
  model = 'gemma3:4b',
  canPull = true,
) {
  act(() => {
    root!.render(
      <ModelStatusBadge
        status={status}
        model={model}
        baseUrl={baseUrl}
        pullProgress={0}
        canPull={canPull}
        onPull={() => {}}
      />,
    )
  })
}

function textContent(): string {
  return container!.textContent ?? ''
}

describe('ModelStatusBadge', () => {
  it('renders nothing when idle', () => {
    render('idle')
    expect(textContent()).toBe('')
  })

  it('renders nothing when model is empty', () => {
    render('checking', 'http://localhost:11434', '')
    expect(textContent()).toBe('')
  })

  it('shows "Checking…" when checking', () => {
    render('checking')
    expect(textContent()).toContain('Checking')
  })

  it('shows "Available" when available', () => {
    render('available')
    expect(textContent()).toContain('Available')
  })

  it('shows "Not found locally" and a pull button when unavailable on localhost', () => {
    render('unavailable')
    expect(textContent()).toContain('Not found locally')
    expect(textContent()).toContain('Pull')
  })

  it('treats 127.0.0.1 as local for unavailable', () => {
    render('unavailable', 'http://127.0.0.1:11434/v1')
    expect(textContent()).toContain('Not found locally')
    expect(textContent()).toContain('Pull')
  })

  it('does not show pull button for non-local endpoints on unavailable', () => {
    render('unavailable', 'https://opencode.ai/zen/v1', 'gemma3:4b', false)
    expect(textContent()).not.toContain('Pull')
  })

  it('shows neutral "Model not found" without local wording for non-local unavailable', () => {
    render('unavailable', 'https://opencode.ai/zen/v1', 'gemma3:4b', false)
    expect(textContent()).toContain('Model not found')
    expect(textContent()).not.toContain('locally')
    expect(textContent()).not.toContain('Pull')
  })

  it('renders nothing when pulling on a non-local endpoint', () => {
    act(() => {
      root!.render(
        <ModelStatusBadge
          status="pulling"
          model="gemma3:4b"
          baseUrl="https://opencode.ai/zen/v1"
          pullProgress={0.42}
          canPull={false}
          onPull={() => {}}
        />,
      )
    })
    expect(textContent()).toBe('')
  })

  it('shows neutral text without Pull for a local non-Ollama endpoint', () => {
    render('unavailable', 'http://127.0.0.1:8888/v1', 'some-model', false)
    expect(textContent()).toContain('Model not found')
    expect(textContent()).not.toContain('locally')
    expect(textContent()).not.toContain('Pull')
  })

  it('renders nothing when pulling without pull capability', () => {
    render('pulling', 'http://localhost:11434', 'gemma3:4b', false)
    expect(textContent()).toBe('')
  })

  it('shows pull progress when pulling', () => {
    act(() => {
      root!.render(
        <ModelStatusBadge
          status="pulling"
          model="gemma3:4b"
          baseUrl="http://localhost:11434"
          pullProgress={0.42}
          canPull
          onPull={() => {}}
        />,
      )
    })
    expect(textContent()).toContain('Pulling')
    expect(textContent()).toContain('42%')
  })

  it('shows "Unauthorized" when status is unauthorized', () => {
    render('unauthorized' as ModelStatus, 'https://opencode.ai/zen/v1')
    expect(textContent()).toContain('Unauthorized')
  })

  it('shows "API unreachable" for error on non-local endpoints', () => {
    render('error', 'https://opencode.ai/zen/v1')
    expect(textContent()).toContain('API unreachable')
  })
})
