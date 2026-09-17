// SPDX-License-Identifier: MIT
import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { checkEndpoint } from '@/llm/completion'
import type { ModelStatus } from '@/lib/ollama'
import type { PullControls } from './useModelPull'

interface EndpointHealthCheckOptions {
  open: boolean
  mentorEnabled: boolean
  aiBaseUrl: string
  aiModel: string
  aiApiKey: string
  setModelStatus: Dispatch<SetStateAction<ModelStatus>>
  invalidatePull: PullControls['invalidatePull']
}

/**
 * Endpoint health check for the AI settings section. Owns its abort
 * controller exclusively; coordination with the pull lifecycle goes through
 * `invalidatePull` (abort + generation invalidation) instead of shared refs.
 * `setModelStatus`/`invalidatePull` are identity-stable, so listing them keeps
 * `useExhaustiveDependencies` quiet without ever re-running the check.
 */
export function useEndpointHealthCheck({
  open,
  mentorEnabled,
  aiBaseUrl,
  aiModel,
  aiApiKey,
  setModelStatus,
  invalidatePull,
}: EndpointHealthCheckOptions) {
  const healthCheckAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open || !mentorEnabled) {
      healthCheckAbortRef.current?.abort()
      invalidatePull()
      setModelStatus('idle')
      return
    }
    // Settings changed while dialog is open and mentor is enabled — abort
    // any in-flight pull and invalidate stale requests so an old pull cannot
    // mark a freshly-selected model as available.
    invalidatePull()

    const controller = new AbortController()
    // Abort any in-flight check from the previous effect invocation.
    healthCheckAbortRef.current?.abort()
    healthCheckAbortRef.current = controller
    setModelStatus('checking')
    checkEndpoint(aiBaseUrl, aiModel, aiApiKey, controller.signal)
      .then((s) => {
        if (!controller.signal.aborted) setModelStatus(s)
      })
      .catch(() => {
        if (!controller.signal.aborted) setModelStatus('error')
      })
    return () => {
      controller.abort()
    }
  }, [open, aiBaseUrl, aiModel, aiApiKey, mentorEnabled, setModelStatus, invalidatePull])
}
