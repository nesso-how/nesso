// SPDX-License-Identifier: MIT
import { expect } from '@wdio/globals'
import {
  addConceptNode,
  DEFAULT_CONCEPT_TEXT,
  newEmptyGraph,
  nodeTextsOnDisk,
  sleep,
  waitForCondition,
} from './helpers.js'

/**
 * The base of the native lane: prove the real fs plugin + disk-first autosave
 * actually land a concept on disk. The Playwright lane runs in a browser
 * (`isDesktop() === false`), so it never exercises this path.
 */
describe('native: graph edits persist to disk', () => {
  it('writes a created concept into a workspace .json file', async () => {
    await newEmptyGraph()
    await addConceptNode()
    // Autosave debounces ~500ms on desktop; give the flush a moment before polling disk.
    await sleep(700)

    await waitForCondition(async () => (await nodeTextsOnDisk()).includes(DEFAULT_CONCEPT_TEXT), {
      timeout: 30_000,
      message: 'the concept to be written to disk',
    })

    expect(await nodeTextsOnDisk()).toContain(DEFAULT_CONCEPT_TEXT)
  })
})
