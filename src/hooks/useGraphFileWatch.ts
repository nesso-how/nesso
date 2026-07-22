// SPDX-License-Identifier: MIT
import { useEffect, useRef } from 'react'
import { mergeGraphDisplay, type GraphDisplaySettings } from '@/types/graph'
import { useGraphStore } from '@/store'
import { graphContentFingerprint } from '@/lib/graphPersist'
import { dbDeleteGraph, dbListGraphs, dbSaveGraph, type GraphRecord } from '@/store/db'
import { normalizeGraphRecord } from '@/lib/graphLoadNormalizer'
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

    // Capture the workspace path at setup time — handleWatchEvent will discard
    // stale runs when the store's activeProjectPath differs (project switched
    // between the debounce timer being set and the handler firing).
    const watcherPath = workspacePath

    // ── tiny predicates extracted from branch-heavy callbacks ──

    /** True when the effect instance is stale: either the active project no
     *  longer matches the watcher that owns this effect (user switched projects
     *  mid-operation), or the generation token advanced because the effect
     *  re-ran (e.g. same-path remount during a pending handler). */
    function isStaleEffect(): boolean {
      return (
        useGraphStore.getState().settings.activeProjectPath !== watcherPath ||
        gen !== setupGenRef.current
      )
    }

    /** Fast combined check for all watch-event suppression conditions.
     *  Equivalent to the three sequential early-returns in the original
     *  anonymous callback — short-circuits left-to-right identically. */
    function shouldSkipWatchEvent(event: { paths: string[] }): boolean {
      return (
        isWatchSuppressed() || isManifestOnlyWatchPaths(event.paths) || isSelfWriteEcho(event.paths)
      )
    }

    // ── watcher event callback (named, extracted from anonymous) ──

    function onWatcherEvent(event: { paths: string[] }) {
      if (shouldSkipWatchEvent(event)) return
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        void handleWatchEvent()
      }, DEBOUNCE_MS)
    }

    // ── watch setup (extracted from the async IIFE) ──

    /** Import the watch plugin, start watching recursive, and guard against
     *  stale effect generations. Returns the unwatch function or null (already
     *  cleaned up) when the effect generation advanced mid-setup. */
    async function startFileWatcher(
      displayPath: string,
      watcherGen: number,
      onEvent: (event: { paths: string[] }) => void,
    ): Promise<(() => void) | null> {
      const { watch } = await import('@tauri-apps/plugin-fs')
      let unwatch!: () => void
      try {
        unwatch = await watch(displayPath, onEvent, { recursive: true })
      } catch (err) {
        console.error('[nesso] watch failed:', err)
        return null
      }
      // Re-check after watch() because the workspace path may have changed
      // while we were awaiting, in which case the newer effect owns the watcher.
      if (watcherGen !== setupGenRef.current) {
        unwatch()
        return null
      }
      return unwatch
    }

    void (async () => {
      const ws = await resolveWorkspace(useGraphStore.getState().settings)
      if (gen !== setupGenRef.current) return

      // The watch command needs the runtime FS scope; this effect can run
      // before loadGraphList has granted the known-project paths.
      await grantFsScope(ws.displayPath).catch(() => {})
      if (gen !== setupGenRef.current) return

      const unwatch = await startFileWatcher(ws.displayPath, gen, onWatcherEvent)
      if (unwatch) unwatchRef.current = unwatch
    })()

    /** Extract a human-readable id from a raw record for log messages. */
    function logIdFromRecord(r: GraphRecord): string {
      return typeof (r as { id?: unknown })?.id === 'string' ? (r as { id: string }).id : '?'
    }

    /** Normalize raw IDB records, skipping any that fail validation.
     *  Corrupt records are preserved in IDB — never deleted. */
    function normalizeIdbList(raw: GraphRecord[]): GraphRecord[] {
      const out: GraphRecord[] = []
      for (const r of raw) {
        try {
          out.push(normalizeGraphRecord(r))
        } catch {
          console.warn('[nesso] watcher skipping corrupt graph record:', logIdFromRecord(r))
        }
      }
      return out
    }

    /** Persist the reconcile results (new writes + removals) to IDB.
     *  Checks stale after each per-record await so that a generation change
     *  mid-loop does not continue mutating IDB for a dead effect. */
    async function persistReconcileResults(
      toPersist: GraphRecord[],
      removed: string[],
    ): Promise<void> {
      for (const rec of toPersist) {
        await dbSaveGraph(rec)
        if (isStaleEffect()) return
      }
      for (const id of removed) {
        await dbDeleteGraph(id)
        if (isStaleEffect()) return
      }
    }

    /** Update the store's graph list from current IDB state. Returns the
     *  freshly-normalized graph records. Returns an empty array when the
     *  effect has gone stale during the IDB read. */
    async function refreshStoreGraphList(): Promise<GraphRecord[]> {
      const records = normalizeIdbList(await dbListGraphs())
      if (isStaleEffect()) return []
      useGraphStore.setState({
        graphList: records.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt })),
      })
      return records
    }

    /** Fingerprint comparison: when the disk fingerprint matches the last
     *  saved/loaded fingerprint, the notification is spurious. */
    function isSpuriousFingerprint(
      diskFingerprint: string,
      savedFingerprint: string | undefined,
    ): boolean {
      return diskFingerprint === savedFingerprint
    }

    /** Check whether the current graph state has unsaved local changes
     *  compared to the last saved/loaded fingerprint. */
    function hasUnsavedLocalChanges(
      nodes: GraphRecord['nodes'],
      edges: GraphRecord['edges'],
      graphDisplay: GraphDisplaySettings,
      savedFingerprint: string | undefined,
    ): boolean {
      const localFp = graphContentFingerprint(nodes, edges, graphDisplay)
      return localFp !== savedFingerprint
    }

    /** True when both lists are empty — no disk changes to apply. */
    function noChangesToApply(toPersist: GraphRecord[], removed: string[]): boolean {
      return toPersist.length === 0 && removed.length === 0
    }

    /** Resolve the workspace and verify it still matches the watcher project.
     *  Returns null when the project changed during the await or the workspace
     *  directory no longer exists (flagged missing in the store). */
    async function resolveAndVerifyWorkspace(): Promise<Awaited<
      ReturnType<typeof resolveWorkspace>
    > | null> {
      const ws = await resolveWorkspace(useGraphStore.getState().settings)
      // Re-check: the project may have changed while resolving the workspace
      // path. A stale resolve must not trigger markProjectMissing or
      // reconcileDiskWithIdb against the wrong project.
      if (isStaleEffect()) return null
      // The workspace folder may have been deleted — flag it missing and
      // switch away, keeping it in the list.
      const { exists } = await import('@tauri-apps/plugin-fs')
      if (await exists(ws.displayPath).catch(() => true)) {
        // Re-check after the async exists call: the project may have changed
        // while the filesystem operation was pending.
        if (isStaleEffect()) return null
        return ws
      }
      // Guard before markProjectMissing: the effect may have gone stale
      // while the exists() call was in flight.
      if (isStaleEffect()) return null
      await useGraphStore.getState().markProjectMissing(ws.displayPath)
      return null
    }

    /** Reconcile disk-origin records with IDB, cache the manifest, and persist
     *  the diff. Returns null when the project switched mid-operation so the
     *  caller can bail out. */
    async function reconcileAndPersist(
      ws: Awaited<ReturnType<typeof resolveWorkspace>>,
    ): Promise<{ toPersist: GraphRecord[]; removed: string[] } | null> {
      const idbRecords = normalizeIdbList(await dbListGraphs())
      const { toPersist, manifest, removed, reservedPaths } = await reconcileDiskWithIdb(
        ws,
        idbRecords,
      )
      // The project may have changed while awaiting reconciliation — before
      // caching or persisting, verify the watcher still targets the same project.
      if (isStaleEffect()) return null
      setDiskSyncCache(ws.displayPath, manifest, reservedPaths)
      await persistReconcileResults(toPersist, removed)
      // Re-check after the IDB mutation: a project switch may have happened
      // during persistReconcileResults, making the stale results below invalid.
      if (isStaleEffect()) return null
      return { toPersist, removed }
    }

    /** Reconcile disk-origin records with IDB, persist the diff, and delegate
     *  graph-level responses when something changed. */
    async function syncAndRespond(ws: Awaited<ReturnType<typeof resolveWorkspace>>): Promise<void> {
      const result = await reconcileAndPersist(ws)
      if (!result) return
      if (noChangesToApply(result.toPersist, result.removed)) return

      const records = await refreshStoreGraphList()
      // The effect may have gone stale while refreshStoreGraphList was
      // awaiting — do not delegate to respondToDiskChanges for a dead effect.
      if (isStaleEffect()) return
      await respondToDiskChanges(result.toPersist, result.removed, records)
    }

    /** Handle graph-level responses after disk changes: if the active graph
     *  was removed, load the next one; if it changed on disk, delegate to
     *  fingerprint-aware reload. */
    async function respondToDiskChanges(
      toPersist: GraphRecord[],
      removed: string[],
      records: GraphRecord[],
    ): Promise<void> {
      // Bail early when the effect went stale — every mutation below is a
      // side-effect on store state that must not execute for a dead effect.
      if (isStaleEffect()) return

      // Re-read the store: the user may have edited or switched graphs while
      // the reconcile above was awaiting.
      const fresh = useGraphStore.getState()

      if (removed.includes(fresh.currentGraphId)) {
        const next = records[0]
        if (next) {
          if (isStaleEffect()) return
          await fresh.loadGraph(next.id)
        }
        return
      }

      if (!toPersist.some((r) => r.id === fresh.currentGraphId)) return

      await reloadIfFingerprintChanged(
        records.find((r) => r.id === fresh.currentGraphId),
        fresh,
      )
    }

    /** Compare the disk fingerprint against the last saved/loaded fingerprint
     *  and reload the graph only when the content genuinely changed and no
     *  unsaved local edits exist. */
    async function reloadIfFingerprintChanged(
      active: GraphRecord | undefined,
      fresh: ReturnType<typeof useGraphStore.getState>,
    ): Promise<void> {
      // The effect may have gone stale between the caller's await and this
      // function — do not mutate store state (setExternalFileConflict / loadGraph)
      // for a dead effect.
      if (isStaleEffect()) return

      if (!active) return
      const diskFingerprint = graphContentFingerprint(
        active.nodes,
        active.edges,
        mergeGraphDisplay(active.display, fresh.settings),
      )
      if (isSpuriousFingerprint(diskFingerprint, fresh.savedFingerprint)) return

      if (
        hasUnsavedLocalChanges(fresh.nodes, fresh.edges, fresh.graphDisplay, fresh.savedFingerprint)
      ) {
        fresh.setExternalFileConflict(true)
        return
      }
      if (isStaleEffect()) return
      await fresh.loadGraph(active.id)
    }

    /** Process a single watch event: guard against project switches, verify
     *  the workspace, and delegate to syncAndRespond. */
    async function processWatchEvent(): Promise<void> {
      // Discard when the project changed between the debounce timer being
      // set and the handler firing — the watcher events belong to a stale
      // workspace and must not reconcile against the new project's IDB.
      if (isStaleEffect()) return

      const ws = await resolveAndVerifyWorkspace()
      if (!ws) return

      await syncAndRespond(ws)
    }

    /** Release the handling lock and re-invoke the handler if a pending event
     *  arrived while we were processing. */
    function releaseAndMaybeReinvoke(): void {
      handlingRef.current = false
      if (pendingRef.current) {
        pendingRef.current = false
        // Do not re-invoke the handler for a dead effect — the pending event
        // belongs to a generation that has been superseded.
        if (!isStaleEffect()) {
          void handleWatchEvent()
        }
      }
    }

    async function handleWatchEvent() {
      if (handlingRef.current) {
        pendingRef.current = true
        return
      }
      handlingRef.current = true
      try {
        await processWatchEvent()
      } finally {
        releaseAndMaybeReinvoke()
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
