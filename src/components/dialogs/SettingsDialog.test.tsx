// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/store'
import { SettingsDialog } from './SettingsDialog'

vi.mock('@/llm/completion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/llm/completion')>()
  return {
    ...actual,
    checkEndpoint: vi.fn().mockResolvedValue('available'),
    executeModelPull: vi.fn().mockResolvedValue(true),
  }
})

let root: Root | null = null
let container: HTMLDivElement | null = null

function setupSettings(
  overrides: Partial<{ aiBaseUrl: string; aiModel: string; aiApiKey: string }>,
) {
  const s = useGraphStore.getState()
  useGraphStore.setState({
    settings: {
      ...s.settings,
      language: 'en',
      mentorEnabled: true,
      aiBaseUrl: 'http://localhost:11434/v1',
      aiModel: 'qwen3:8b',
      aiApiKey: '',
      ...overrides,
    },
  })
}

async function openAiTab(): Promise<void> {
  await act(async () => {
    root!.render(<SettingsDialog open onClose={() => {}} />)
  })
  const aiTab = [...container!.querySelectorAll('button')].find((b) => b.textContent === 'AI')
  if (!aiTab) throw new Error('AI tab button not found')
  await act(async () => {
    aiTab.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount()
    })
    root = null
  }
  if (container) {
    container.remove()
    container = null
  }
  vi.clearAllMocks()
})

describe('SettingsDialog AI presets gating', () => {
  it('shows Ollama preset chips for a localhost endpoint', async () => {
    setupSettings({ aiBaseUrl: 'http://localhost:11434/v1', aiModel: 'qwen3:8b' })
    await openAiTab()
    expect(container!.textContent).toContain('llama3.2:3b')
    expect(container!.textContent).toContain('qwen3:8b')
  })

  it('hides Ollama preset chips for a remote endpoint', async () => {
    setupSettings({
      aiBaseUrl: 'https://opencode.ai/zen/v1',
      aiModel: 'big-pickle',
      aiApiKey: 'test-key',
    })
    await openAiTab()
    expect(container!.textContent).not.toContain('llama3.2:3b')
    expect(container!.textContent).not.toContain('qwen3:8b')
  })
})
