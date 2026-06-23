// SPDX-License-Identifier: MIT
import { expect } from '@wdio/globals'
import {
  addConceptNode,
  DEFAULT_CONCEPT_TEXT,
  DEFAULT_GRAPH_NAME,
  graphFileStemContaining,
  newEmptyGraph,
  nodeByText,
  nodeTextsOnDisk,
  sleep,
  waitForCondition,
  waitForConceptOnCanvas,
  writeExternalGraph,
} from './helpers.js'

/**
 * desktop-sync's reconcile path: when the active graph's file changes on disk
 * and there are no unsaved local edits, the watcher reloads the canvas from
 * disk (rather than raising the conflict banner). The conflict branch itself
 * needs deterministic control over unsaved-edit timing and is a follow-up.
 */
describe('native: desktop-sync reloads the active graph after an external edit', () => {
  it('replaces canvas content when the active file changes on disk', async () => {
    await newEmptyGraph()
    await addConceptNode()
    await waitForCondition(async () => (await nodeTextsOnDisk()).includes(DEFAULT_CONCEPT_TEXT), {
      timeout: 30_000,
      message: 'the original concept to be saved before the external edit',
    })
    // Let the saved fingerprint settle so there are no "unsaved local edits"
    // (which would raise the conflict banner instead of an in-place reload).
    await sleep(1000)

    const stem = await graphFileStemContaining(DEFAULT_CONCEPT_TEXT)
    expect(stem).not.toBeNull()

    // Same filename → same manifest id binding, so this updates the active graph.
    await writeExternalGraph(stem as string, 'ReplacedConcept')

    await waitForConceptOnCanvas('ReplacedConcept', {
      graphName: DEFAULT_GRAPH_NAME,
      timeout: 60_000,
    })
    await expect(nodeByText(DEFAULT_CONCEPT_TEXT)).not.toExist()
  })
})
