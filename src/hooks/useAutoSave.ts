// SPDX-License-Identifier: MIT
import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { graphPersistFingerprint } from '@/lib/graphPersist'
import { useGraphStore } from '@/store'

const DEBOUNCE_MS = 5000

function flushPendingSave(getViewport: () => { x: number; y: number; zoom: number }) {
  const state = useGraphStore.getState()
  if (state.externalFileConflict) return
  const vp = getViewport()
  state.saveViewport(state.currentGraphId, vp)
  void state.saveCurrentGraph()
}

// Viewport is also saved from GraphCanvas `onMoveEnd` when only pan/zoom/fit changes (no node/edge edits).
export function useAutoSave() {
  const { getViewport } = useReactFlow()
  const getViewportRef = useRef(getViewport)
  getViewportRef.current = getViewport

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastToken = useRef<number | null>(null)
  const lastFingerprint = useRef<string | null>(null)

  useEffect(() => {
    const scheduleSave = (fingerprint: string) => {
      const { loadedToken, externalFileConflict } = useGraphStore.getState()

      if (externalFileConflict) {
        if (timer.current) {
          clearTimeout(timer.current)
          timer.current = null
        }
        return
      }

      // Skip loads that replace nodes/edges without a real edit.
      if (lastToken.current !== loadedToken) {
        lastToken.current = loadedToken
        lastFingerprint.current = fingerprint
        return
      }
      if (lastFingerprint.current === fingerprint) return
      lastFingerprint.current = fingerprint

      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        timer.current = null
        flushPendingSave(getViewportRef.current)
      }, DEBOUNCE_MS)
    }

    const initial = useGraphStore.getState()
    lastToken.current = initial.loadedToken
    lastFingerprint.current = graphPersistFingerprint(
      initial.nodes,
      initial.edges,
      initial.graphDisplay,
    )

    const unsub = useGraphStore.subscribe((state, prevState) => {
      const fingerprint = graphPersistFingerprint(state.nodes, state.edges, state.graphDisplay)
      const prevFingerprint = graphPersistFingerprint(
        prevState.nodes,
        prevState.edges,
        prevState.graphDisplay,
      )
      if (fingerprint === prevFingerprint && state.loadedToken === prevState.loadedToken) return
      scheduleSave(fingerprint)
    })

    const onPageHide = () => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
      flushPendingSave(getViewportRef.current)
    }
    window.addEventListener('pagehide', onPageHide)

    return () => {
      unsub()
      window.removeEventListener('pagehide', onPageHide)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])
}
