// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import { createRoot, type Root } from 'react-dom/client'
import { act, useState } from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/store'
import { ReviewMode } from './ReviewMode'

const { mockTrack } = vi.hoisted(() => ({
  mockTrack: vi.fn(),
}))

vi.mock('@/telemetry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/telemetry')>()
  return { ...actual, track: mockTrack }
})

let root: Root | null = null
let container: HTMLDivElement | null = null
/** Exposed by TestHarness so tests can trigger a close from outside. */
let triggerClose: (() => void) | null = null

function TestHarness({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  // Store the setter in the module-level ref so tests can call it
  triggerClose = () => setOpen(false)
  return <ReviewMode open={open} onClose={() => setOpen(false)} />
}

function setupStore() {
  // Reset to a clean state so each test starts fresh.
  // Zustand v5 persist middleware writes to localStorage by default; jsdom provides it.
  useGraphStore.setState({
    nodes: [],
    edges: [],
    selected: null,
    selectedIds: [],
    editNodeId: null,
  })
}

beforeEach(() => {
  mockTrack.mockClear()
  triggerClose = null
  setupStore()

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
  triggerClose = null
})

/** Helper: simulate pressing a keyboard key on window. */
function pressKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

/**
 * Helper: rate the current card as "Good" (rating index 2 → key '3').
 * Reveals the card first via space bar, then rates it.
 */
async function rateGood() {
  await act(async () => {
    pressKey(' ') // reveal
  })
  await act(async () => {
    pressKey('3') // rate Good
  })
}

describe('ReviewMode telemetry', () => {
  it('emits review_session_completed when all due cards are rated', async () => {
    // Seed 1 due node
    useGraphStore.getState().addNode(0, 0)

    await act(async () => {
      root!.render(<TestHarness />)
    })

    // The session should have 1 due card; rating it exhausts the queue.
    await rateGood()

    // The advance function emits review_session_completed before calling onClose.
    // We must also still see the existing review_card_rated event.
    expect(mockTrack).toHaveBeenCalledWith({
      name: 'review_card_rated',
      props: { rating: 'good' },
    })
    expect(mockTrack).toHaveBeenCalledWith({
      name: 'review_session_completed',
      props: { rated_cards_bucket: '1-2' },
    })
  })

  it('emits review_session_abandoned when the user exits before completing', async () => {
    // Seed 2 due nodes so the session is not exhausted after 1 rating.
    useGraphStore.getState().addNode(0, 0)
    useGraphStore.getState().addNode(0, 0)

    await act(async () => {
      root!.render(<TestHarness />)
    })

    // Rate 1 card → 1 rated, 1 still due.
    await rateGood()

    // Now close the session early.
    await act(async () => {
      triggerClose!()
    })

    expect(mockTrack).toHaveBeenCalledWith({
      name: 'review_session_abandoned',
      props: { rated_cards_bucket: '1-2' },
    })
    // Must NOT emit review_session_completed.
    expect(mockTrack).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'review_session_completed' }),
    )
  })

  it('emits review_session_abandoned with bucket "0" when no cards are rated', async () => {
    // Seed 1 due node, but close without rating anything.
    useGraphStore.getState().addNode(0, 0)

    await act(async () => {
      root!.render(<TestHarness />)
    })

    // Close immediately without revealing or rating.
    await act(async () => {
      triggerClose!()
    })

    expect(mockTrack).toHaveBeenCalledWith({
      name: 'review_session_abandoned',
      props: { rated_cards_bucket: '0' },
    })
    // Must NOT emit review_session_completed.
    expect(mockTrack).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'review_session_completed' }),
    )
  })
})
