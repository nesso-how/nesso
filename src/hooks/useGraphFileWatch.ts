// SPDX-License-Identifier: MIT
import { useEffect, useRef } from 'react'
import { useGraphStore } from '@/store/graph'
import { graphPersistFingerprint } from '@/lib/graphPersist'
import { dbListGraphs, dbSaveGraph } from '@/store/db'
import { isDesktop } from '@/lib/isDesktop'
import {
  isManifestOnlyWatchPaths,
  isWatchSuppressed,
  reconcileDiskWithIdb,
  resolveWorkspace,
  setDiskSyncCache,
} from '@/lib/workspace'

// 400 ms batches rapid multi-event bursts common with editors that write then chmod.
const DEBOUNCE_MS = 400

export function useGraphFileWatch() {
  const workspacePath = useGraphStore((s) => s.settings.graphWorkspacePath)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unwatchRef = useRef<(() => void) | null>(null)
  // Incremented on every setup; checked after the async watch() resolves to
  // discard stale setups when workspacePath changed during the await.
  const setupGenRef = useRef(0)
  const handlingRef = useRef(false)
  // Set when an event arrives while handleWatchEvent is still running, so the
  // handler re-runs once after it finishes rather than silently dropping it.
  const pendingRef = useRef(false)

  useEffect(() => {
    if (!isDesktop()) return

    const gen = ++setupGenRef.current

    unwatchRef.current?.()
    unwatchRef.current = null
    if (timer.current) clearTimeout(timer.current)

    void (async () => {
      const ws = await resolveWorkspace(useGraphStore.getState().settings)
      if (gen !== setupGenRef.current) return

      const { watch } = await import('@tauri-apps/plugin-fs')
      let unwatch!: () => void
      try {
        unwatch = await watch(
          ws.displayPath,
          (event) => {
            if (isWatchSuppressed()) return
            if (isManifestOnlyWatchPaths(event.paths)) return
            if (timer.current) clearTimeout(timer.current)
            timer.current = setTimeout(() => {
              void handleWatchEvent()
            }, DEBOUNCE_MS)
          },
          { recursive: true },
        )
      } catch (err) {
        console.error('[nesso] watch failed:', err)
        return
      }

      // Re-check after watch() because the workspace path may have changed
      // while we were awaiting, in which case the newer effect owns the watcher.
      if (gen !== setupGenRef.current) {
        unwatch()
        return
      }
      unwatchRef.current = unwatch
    })()

    async function handleWatchEvent() {
      if (handlingRef.current) {
        pendingRef.current = true
        return
      }
      handlingRef.current = true
      try {
        const state = useGraphStore.getState()
        const ws = await resolveWorkspace(state.settings)
        const idbRecords = await dbListGraphs()
        const { toPersist, manifest } = await reconcileDiskWithIdb(ws, idbRecords)
        setDiskSyncCache(ws.displayPath, manifest)
        for (const rec of toPersist) {
          await dbSaveGraph(rec)
        }

        if (toPersist.length === 0) return

        const records = await dbListGraphs()
        useGraphStore.setState({
          graphList: records.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt })),
        })

        const changedFromDisk = new Set(toPersist.map((r) => r.id))
        if (!changedFromDisk.has(state.currentGraphId)) return

        const localFp = graphPersistFingerprint(state.nodes, state.edges, state.graphDisplay)
        const active = records.find((r) => r.id === state.currentGraphId)
        if (!active) return

        if (localFp !== state.savedFingerprint) {
          useGraphStore.getState().setExternalFileConflict(true)
          return
        }
        await useGraphStore.getState().loadGraph(active.id)
      } finally {
        handlingRef.current = false
        if (pendingRef.current) {
          pendingRef.current = false
          void handleWatchEvent()
        }
      }
    }

    return () => {
      setupGenRef.current++
      if (timer.current) clearTimeout(timer.current)
      unwatchRef.current?.()
      unwatchRef.current = null
    }
  }, [workspacePath])
}
