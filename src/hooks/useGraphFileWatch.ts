// SPDX-License-Identifier: MIT
import { useEffect, useRef } from 'react'
import { mergeGraphDisplay } from '@/types/graph'
import { useGraphStore } from '@/store'
import { graphContentFingerprint } from '@/lib/graphPersist'
import { dbDeleteGraph, dbListGraphs, dbSaveGraph } from '@/store/db'
import { isDesktop } from '@/lib/isDesktop'
import {
  grantFsScope,
  isManifestOnlyWatchPaths,
  isSelfWriteEcho,
  isWatchSuppressed,
  reconcileDiskWithIdb,
  resolveWorkspace,
  setDiskSyncCache,
} from '@/lib/workspace'

// 400 ms batches rapid multi-event bursts common with editors that write then chmod.
const DEBOUNCE_MS = 400

export function useGraphFileWatch() {
  const workspacePath = useGraphStore((s) => s.settings.activeProjectPath)
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

      // The watch command needs the runtime FS scope; this effect can run
      // before loadGraphList has granted the known-project paths.
      await grantFsScope(ws.displayPath).catch(() => {})
      if (gen !== setupGenRef.current) return

      const { watch } = await import('@tauri-apps/plugin-fs')
      let unwatch!: () => void
      try {
        unwatch = await watch(
          ws.displayPath,
          (event) => {
            if (isWatchSuppressed()) return
            if (isManifestOnlyWatchPaths(event.paths)) return
            // Delayed echo of the app's own writes — without this every
            // autosave triggers a full re-read of the workspace.
            if (isSelfWriteEcho(event.paths)) return
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

        // The whole project folder may have been deleted, moved or renamed —
        // without this check the reconcile below would recreate it from the IDB
        // cache. Flag it missing and switch away, keeping it in the list.
        const { exists } = await import('@tauri-apps/plugin-fs')
        if (!(await exists(ws.displayPath).catch(() => true))) {
          await useGraphStore.getState().markProjectMissing(ws.displayPath)
          return
        }

        const idbRecords = await dbListGraphs()
        const { toPersist, manifest, removed } = await reconcileDiskWithIdb(ws, idbRecords)
        setDiskSyncCache(ws.displayPath, manifest)
        for (const rec of toPersist) {
          await dbSaveGraph(rec)
        }
        for (const id of removed) {
          await dbDeleteGraph(id)
        }

        if (toPersist.length === 0 && removed.length === 0) return

        const records = await dbListGraphs()
        useGraphStore.setState({
          graphList: records.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt })),
        })

        // Re-read the store: the user may have edited or switched graphs while
        // the reconcile above was awaiting — deciding on the stale snapshot
        // could reload over fresh edits without flagging a conflict.
        const fresh = useGraphStore.getState()

        if (removed.includes(fresh.currentGraphId)) {
          const next = records[0]
          if (next) await fresh.loadGraph(next.id)
          return
        }

        const changedFromDisk = new Set(toPersist.map((r) => r.id))
        if (!changedFromDisk.has(fresh.currentGraphId)) return

        const active = records.find((r) => r.id === fresh.currentGraphId)
        if (!active) return

        // Compare the freshly-synced disk fingerprint against what we last
        // saved/loaded. If they match, this is a spurious notification —
        // e.g. a self-healing name/id rewrite that bumped updatedAt without
        // changing content, or a name-only change. Skip it entirely.
        const diskFingerprint = graphContentFingerprint(
          active.nodes,
          active.edges,
          mergeGraphDisplay(active.display, fresh.settings),
        )
        if (diskFingerprint === fresh.savedFingerprint) return

        // Disk content actually diverges from what we last saved/loaded.
        // If the user also has unsaved local changes, it's a real conflict.
        const localFp = graphContentFingerprint(fresh.nodes, fresh.edges, fresh.graphDisplay)
        if (localFp !== fresh.savedFingerprint) {
          fresh.setExternalFileConflict(true)
          return
        }
        // Local is clean — safe to auto-reload the disk content.
        await fresh.loadGraph(active.id)
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
