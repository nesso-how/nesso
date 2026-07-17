// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'

// Suppress act() warnings in React 18 jsdom tests without @testing-library/react.
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/store'
import { MentorPanel } from './MentorPanel'

const { mockTrack } = vi.hoisted(() => ({
  mockTrack: vi.fn(),
}))

vi.mock('@/telemetry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/telemetry')>()
  return { ...actual, track: mockTrack }
})

const { mockFetchCompletion } = vi.hoisted(() => ({
  mockFetchCompletion: vi.fn(),
}))

vi.mock('@/llm/completion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/llm/completion')>()
  return {
    ...actual,
    fetchCompletion: mockFetchCompletion,
    isAiReady: vi.fn().mockReturnValue(true),
    describeCompletionError: vi.fn().mockReturnValue('Test error'),
    isNetworkFailure: vi.fn().mockReturnValue(false),
  }
})

let root: Root | null = null
let container: HTMLDivElement | null = null

function setupStore() {
  // Ensure the store has default settings with a valid AI endpoint so isAiReady → true.
  const s = useGraphStore.getState()
  useGraphStore.setState({
    nodes: [],
    edges: [],
    selected: null,
    selectedIds: [],
    editNodeId: null,
    mentorPanelExpanded: true,
    currentGraphId: 'test-graph-1',
    settings: {
      ...s.settings,
      aiBaseUrl: 'http://localhost:11434/v1',
      aiModel: 'gemma3:4b',
      language: 'en',
    },
  })
}

beforeEach(() => {
  mockTrack.mockClear()
  mockFetchCompletion.mockClear()
  setupStore()

  // Mock fetchCompletion to resolve immediately so the LLM effect doesn't hang.
  // Call onToken to simulate a completed response so loadingInitial becomes false.
  mockFetchCompletion.mockImplementation(
    async (
      _settings: unknown,
      _request: unknown,
      _maxTokens: unknown,
      _signal: unknown,
      handlers: { onToken?: (delta: string) => void } | undefined,
    ) => {
      handlers?.onToken?.('Hello')
      return 'Hello'
    },
  )

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

describe('MentorPanel telemetry', () => {
  it('does not emit session events when the panel closes with no user messages', async () => {
    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    await act(async () => {
      useGraphStore.getState().setMentorPanelExpanded(false)
    })

    const sessionEvents = mockTrack.mock.calls.filter((c: unknown[]) => {
      const name = (c[0] as { name: string }).name
      return name === 'mentor_session_abandoned' || name === 'mentor_session_completed'
    })
    expect(sessionEvents).toHaveLength(0)
  })

  it('does not emit session events on unmount with no user messages', async () => {
    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    await act(async () => {
      root!.unmount()
    })

    const sessionEvents = mockTrack.mock.calls.filter((c: unknown[]) => {
      const name = (c[0] as { name: string }).name
      return name === 'mentor_session_abandoned' || name === 'mentor_session_completed'
    })
    expect(sessionEvents).toHaveLength(0)
  })

  it('does not emit session events when the graph changes with no user messages', async () => {
    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    await act(async () => {
      useGraphStore.setState({ currentGraphId: 'test-graph-2' })
    })

    const sessionEvents = mockTrack.mock.calls.filter((c: unknown[]) => {
      const name = (c[0] as { name: string }).name
      return name === 'mentor_session_abandoned' || name === 'mentor_session_completed'
    })
    expect(sessionEvents).toHaveLength(0)
  })

  it('emits mentor_session_completed when user sends a message and gets a mentor reply before closing', async () => {
    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    // Type a message and press Enter to send it.
    const textarea = container!.querySelector('textarea')!
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )!.set!

    await act(async () => {
      nativeSetter.call(textarea, 'What is knowledge?')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await act(async () => {
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })

    // Close the panel — the last message is the mentor reply.
    await act(async () => {
      useGraphStore.getState().setMentorPanelExpanded(false)
    })

    expect(mockTrack).toHaveBeenCalledWith({
      name: 'mentor_session_completed',
      props: { message_count_bucket: '1-2' },
    })
    expect(mockTrack).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'mentor_session_abandoned' }),
    )
  })

  it('emits mentor_session_abandoned when user sends a message and the reply errors out before closing', async () => {
    // First call (initial seed) succeeds normally.
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: unknown,
        handlers: { onToken?: (delta: string) => void } | undefined,
      ) => {
        handlers?.onToken?.('Hello')
        return 'Hello'
      },
    )

    // Second call (user send) throws — the reply is an error message.
    mockFetchCompletion.mockImplementationOnce(async () => {
      throw new Error('Connection refused')
    })

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    const textarea = container!.querySelector('textarea')!
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )!.set!

    await act(async () => {
      nativeSetter.call(textarea, 'Hello?')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await act(async () => {
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })

    // Close the panel — the last message was an error from mentor, not a clean reply.
    await act(async () => {
      useGraphStore.getState().setMentorPanelExpanded(false)
    })

    expect(mockTrack).toHaveBeenCalledWith({
      name: 'mentor_session_abandoned',
      props: { message_count_bucket: '1-2' },
    })
    expect(mockTrack).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'mentor_session_completed' }),
    )
  })
})
