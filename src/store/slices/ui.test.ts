// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { ZUSTAND_PERSIST_KEY } from '@/data/storageKeys'
import { useGraphStore } from '../index'
import type { GraphState } from '../state'
import { createUISlice } from './ui'

// Slice-behavior tests run against a headless vanilla store composed from the
// UI slice alone (same pattern as graph-editing.test.ts) — no persist
// middleware, localStorage, or the other slices. Slice creators are typed over
// the full GraphState, so the composition carries one explicit `as GraphState`
// assertion; the slice only ever sets UI fields.
function makeHeadlessStore() {
  return createStore<GraphState>()(
    (...a) =>
      ({
        ...createUISlice(...a),
      }) as GraphState,
  )
}

describe('review reminder UI state', () => {
  it('records local days immutably and independently by graph', () => {
    const store = makeHeadlessStore()
    const initial = store.getState().reviewReminderLastShownByGraph

    store.getState().markReviewReminderShown('graph-a', '2026-07-22')
    store.getState().markReviewReminderShown('graph-b', '2026-07-21')

    expect(store.getState().reviewReminderLastShownByGraph).toEqual({
      'graph-a': '2026-07-22',
      'graph-b': '2026-07-21',
    })
    expect(store.getState().reviewReminderLastShownByGraph).not.toBe(initial)
  })
})

describe('writing mode ui state', () => {
  it('opens and closes transiently', () => {
    const store = makeHeadlessStore()
    expect(store.getState().writingModeNodeId).toBeNull()
    store.getState().openWritingMode('n1')
    expect(store.getState().writingModeNodeId).toBe('n1')
    store.getState().closeWritingMode()
    expect(store.getState().writingModeNodeId).toBeNull()
  })

  // Persistence is a property of the real composed store (persist middleware
  // partialization), so this assertion alone uses `useGraphStore`.
  it('is never written to the persisted store blob', () => {
    useGraphStore.getState().openWritingMode('n1')
    const raw = window.localStorage.getItem(ZUSTAND_PERSIST_KEY)
    expect(raw).not.toBeNull()
    if (raw === null) throw new Error('expected a persisted store blob')
    const persisted = JSON.parse(raw) as {
      version: number
      state: Record<string, unknown>
    }
    // Zustand persist wraps the partialized state: { version, state }.
    expect(typeof persisted.version).toBe('number')
    // Non-vacuous guard: a known persisted field must be present in `state`,
    // proving the subtree below is the real serialized state.
    expect(persisted.state).toHaveProperty('reviewReminderLastShownByGraph')
    expect(persisted.state).not.toHaveProperty('writingModeNodeId')
    useGraphStore.getState().closeWritingMode()
    window.localStorage.removeItem(ZUSTAND_PERSIST_KEY)
  })
})
