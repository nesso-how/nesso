// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { createUISlice, type UISlice } from './ui'

describe('review reminder UI state', () => {
  it('records local days immutably and independently by graph', () => {
    const store = createStore<UISlice>()((set, get, api) =>
      createUISlice(set as never, get as never, api as never),
    )
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
