// SPDX-License-Identifier: MIT
import { useState, useEffect, useCallback, useRef } from 'react'
import { executeModelPull } from '@/llm/completion'
import type { ModelStatus } from '@/lib/ollama'

/**
 * Narrow coordination contract between the pull lifecycle and the health
 * check. The health check must be able to cancel an in-flight pull and retire
 * its generation when settings change, without touching the pull's refs —
 * that shared-ref access was the coupling this split removes.
 */
export interface PullControls {
  /**
   * Abort the in-flight pull and retire its generation so a stale pull can
   * never commit status for a freshly-selected model.
   */
  invalidatePull: () => void
}

interface ModelPullOptions {
  open: boolean
  aiBaseUrl: string
  aiModel: string
}

/**
 * Model-pull lifecycle for the AI settings section. Owns the pull abort
 * controller, the monotonic request generation, the pull progress, and the
 * model status it shares (via setter) with the health check. Exposes only
 * `PullControls` for cross-lifecycle coordination.
 */
export function useModelPull({ open, aiBaseUrl, aiModel }: ModelPullOptions) {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [pullProgress, setPullProgress] = useState(0)

  const pullAbortRef = useRef<AbortController | null>(null)
  /** Monotonic counter — bumped on each new pull or settings invalidation. */
  const pullRequestIdRef = useRef(0)

  const invalidatePull = useCallback(() => {
    pullAbortRef.current?.abort()
    pullRequestIdRef.current = 0
  }, [])

  const handlePull = useCallback(async () => {
    pullAbortRef.current?.abort()
    pullRequestIdRef.current += 1
    const requestId = pullRequestIdRef.current

    const controller = new AbortController()
    pullAbortRef.current = controller
    setModelStatus('pulling')
    setPullProgress(0)

    const guardedProgress = (fraction: number) => {
      if (pullRequestIdRef.current === requestId) setPullProgress(fraction)
    }

    const ok = await executeModelPull(aiBaseUrl, aiModel, controller.signal, guardedProgress)
    // Only update state if this is still the latest pull request AND not aborted.
    if (!controller.signal.aborted && pullRequestIdRef.current === requestId) {
      setModelStatus(ok ? 'available' : 'error')
    }
  }, [aiBaseUrl, aiModel])

  // Stop watching the pull stream when the dialog closes.
  useEffect(() => {
    if (!open) pullAbortRef.current?.abort()
  }, [open])

  return { modelStatus, setModelStatus, pullProgress, handlePull, invalidatePull }
}
