import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useGraphStore } from '@/store/graph'

const DEBOUNCE_MS = 800

export function useAutoSave() {
  const nodes = useGraphStore(s => s.nodes)
  const edges = useGraphStore(s => s.edges)
  const currentGraphId = useGraphStore(s => s.currentGraphId)
  const saveCurrentGraph = useGraphStore(s => s.saveCurrentGraph)
  const saveViewport = useGraphStore(s => s.saveViewport)
  const { getViewport } = useReactFlow()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const vp = getViewport()
      saveViewport(currentGraphId, vp)
      saveCurrentGraph()
    }, DEBOUNCE_MS)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [nodes, edges, currentGraphId, saveCurrentGraph, saveViewport, getViewport])
}
