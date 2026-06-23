// SPDX-License-Identifier: MIT
import { browser } from '@wdio/globals'
import {
  addConceptNode,
  DEFAULT_CONCEPT_TEXT,
  newEmptyGraph,
  nodeTextsOnDisk,
  waitForAppReady,
  waitForConceptOnCanvas,
  waitForCondition,
} from './helpers.js'

/**
 * Disk is the source of truth on desktop and IndexedDB only caches the active
 * project, so a fresh app process must rehydrate the graph from disk. A web
 * reload cannot prove this — it keeps the same IndexedDB; only a real relaunch
 * of the native shell does.
 */
describe('native: a graph survives an app relaunch', () => {
  it('rehydrates the concept from disk after reloadSession', async () => {
    await newEmptyGraph()
    await addConceptNode()
    await waitForCondition(async () => (await nodeTextsOnDisk()).includes(DEFAULT_CONCEPT_TEXT), {
      timeout: 30_000,
      message: 'the concept to be persisted before relaunch',
    })

    // Fresh app process; the workspace dir is reset in `before` (per spec), not
    // on reloadSession. The graph list rehydrates from disk regardless of whether
    // kept the active-graph id across relaunch, so open it explicitly.
    await browser.reloadSession()
    await waitForAppReady()

    await waitForConceptOnCanvas(DEFAULT_CONCEPT_TEXT)
  })
})
