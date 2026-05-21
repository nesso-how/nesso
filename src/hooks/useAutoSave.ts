// SPDX-License-Identifier: MIT
import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { graphPersistFingerprint } from '@/lib/graphPersist'
import { useGraphStore } from '@/store/graph'

const DEBOUNCE_MS = 5000

// Viewport is also saved from GraphCanvas `onMoveEnd` when only pan/zoom/fit changes (no node/edge edits).
export function useAutoSave() {
  const fingerprint = useGraphStore(s =>
    graphPersistFingerprint(s.nodes, s.edges, s.graphDisplay))
  const currentGraphId = useGraphStore(s => s.currentGraphId)
  const loadedToken = useGraphStore(s => s.loadedToken)
  const saveCurrentGraph = useGraphStore(s => s.saveCurrentGraph)
  const saveViewport = useGraphStore(s => s.saveViewport)
  const externalFileConflict = useGraphStore(s => s.externalFileConflict)
  const { getViewport } = useReactFlow()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastToken = useRef<number | null>(null)
  const lastFingerprint = useRef<string | null>(null)

  useEffect(() => {
    if (externalFileConflict && timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [externalFileConflict])

  useEffect(() => {
    // Skip mount and any run triggered by a load (which replace nodes/edges
    // without representing a real edit) — otherwise updatedAt bumps and the
    // sidebar reorders on graph switch.
    if (lastToken.current !== loadedToken) {
      lastToken.current = loadedToken
      lastFingerprint.current = fingerprint
      return
    }
    if (lastFingerprint.current === fingerprint) return
    lastFingerprint.current = fingerprint
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (useGraphStore.getState().externalFileConflict) return
      const vp = getViewport()
      saveViewport(currentGraphId, vp)
      saveCurrentGraph()
    }, DEBOUNCE_MS)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [fingerprint, currentGraphId, loadedToken, saveCurrentGraph, saveViewport, getViewport])
}
