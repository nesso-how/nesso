// SPDX-License-Identifier: MIT
import { expect } from '@wdio/globals'
import { graphRow, sleep, waitForAppReady, writeExternalGraph } from './helpers.js'

/**
 * `useGraphFileWatch` runs the real Tauri fs watcher and reconciles disk with
 * IndexedDB. The Vitest desktop suite mocks the fs plugin and dispatches a
 * synthetic event; only here does an actual external write to the watched
 * directory drive the watcher end to end.
 */
describe('native: the file watcher reconciles an externally added graph', () => {
  it('lists a graph dropped into the workspace by another process', async () => {
    await waitForAppReady()
    // The watcher is established in a mount effect (resolveWorkspace + watch());
    // let it settle before writing so the create event is observed.
    await sleep(1500)

    await writeExternalGraph('ExternallyAdded', 'FromDisk')

    // 400ms watch debounce + reconcile; generous margin under xvfb.
    const row = graphRow('ExternallyAdded')
    await row.waitForExist({ timeout: 20_000 })
    await expect(row).toExist()
  })
})
