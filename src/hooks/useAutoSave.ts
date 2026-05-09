// SPDX-License-Identifier: MIT
import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useGraphStore } from '@/store/graph'

const DEBOUNCE_MS = 500

// Viewport is also saved from GraphCanvas `onMoveEnd` when only pan/zoom/fit changes (no node/edge edits).
export function useAutoSave() {
  const nodes = useGraphStore(s => s.nodes)
  const edges = useGraphStore(s => s.edges)
  const currentGraphId = useGraphStore(s => s.currentGraphId)
  const loadedToken = useGraphStore(s => s.loadedToken)
  const saveCurrentGraph = useGraphStore(s => s.saveCurrentGraph)
  const saveViewport = useGraphStore(s => s.saveViewport)
  const { getViewport } = useReactFlow()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastToken = useRef<number | null>(null)

  useEffect(() => {
    // Skip mount and any run triggered by a load (which replace nodes/edges
    // without representing a real edit) — otherwise updatedAt bumps and the
    // sidebar reorders on graph switch.
    if (lastToken.current !== loadedToken) {
      lastToken.current = loadedToken
      return
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const vp = getViewport()
      saveViewport(currentGraphId, vp)
      saveCurrentGraph()
    }, DEBOUNCE_MS)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [nodes, edges, currentGraphId, loadedToken, saveCurrentGraph, saveViewport, getViewport])
}
