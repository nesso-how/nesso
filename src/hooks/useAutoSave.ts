// SPDX-License-Identifier: MIT
import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { graphPersistFingerprint } from '@/lib/graphPersist'
import { useGraphStore } from '@/store'

const DEBOUNCE_MS = 500

// Viewport is also saved from GraphCanvas `onMoveEnd` when only pan/zoom/fit changes (no node/edge edits).
export function useAutoSave() {
  // Schedule on cheap reference changes; the (expensive, full-graph JSON)
  // fingerprint is computed only once inside the debounced timer — computing
  // it in a selector would serialize the whole graph on every store update,
  // including each drag frame.
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const graphDisplay = useGraphStore((s) => s.graphDisplay)
  const loadedToken = useGraphStore((s) => s.loadedToken)
  const externalFileConflict = useGraphStore((s) => s.externalFileConflict)
  const { getViewport } = useReactFlow()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastToken = useRef<number | null>(null)

  useEffect(() => {
    if (externalFileConflict && timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [externalFileConflict])

  useEffect(() => {
    // Skip mount and any run triggered by a load (which replaces nodes/edges
    // without representing a real edit) — otherwise updatedAt bumps and the
    // sidebar reorders on graph switch.
    if (lastToken.current !== loadedToken) {
      lastToken.current = loadedToken
      return
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const s = useGraphStore.getState()
      if (s.externalFileConflict) return
      // Selection-only changes recreate node/edge objects but strip out of the
      // persisted payload — skip when nothing persistable actually changed.
      const fp = graphPersistFingerprint(s.nodes, s.edges, s.graphDisplay)
      if (fp === s.savedFingerprint) return
      s.saveViewport(s.currentGraphId, getViewport())
      void s.saveCurrentGraph()
    }, DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [nodes, edges, graphDisplay, loadedToken, getViewport])
}
