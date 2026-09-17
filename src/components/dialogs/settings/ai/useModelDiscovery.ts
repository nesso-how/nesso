// SPDX-License-Identifier: MIT
import { useState, useEffect, useRef } from 'react'
import { useGraphStore } from '@/store'
import { isOllamaNative, listEndpointModels } from '@/llm/completion'

interface ModelDiscoveryOptions {
  open: boolean
  mentorEnabled: boolean
  aiBaseUrl: string
  aiApiKey: string
  setSetting: (key: 'aiModel', value: string) => void
}

/**
 * Provider-agnostic model discovery for the AI settings section. Lists the
 * endpoint's own `/models` inventory plus the native-Ollama probe that drives
 * the Pull affordance. Owns its abort controller exclusively — it shares no
 * cancellation state with the health check or the pull lifecycle.
 */
export function useModelDiscovery({
  open,
  mentorEnabled,
  aiBaseUrl,
  aiApiKey,
  setSetting,
}: ModelDiscoveryOptions) {
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [customModelOpen, setCustomModelOpen] = useState(false)
  // Whether the endpoint speaks the native Ollama API (`/api/version` probe).
  // null = not probed yet: Pull stays offered on loopback until the endpoint
  // positively proves otherwise, so starting a local Ollama mid-dialog keeps
  // working exactly as before.
  const [ollamaNative, setOllamaNative] = useState<boolean | null>(null)

  const modelsAbortRef = useRef<AbortController | null>(null)

  // Provider-agnostic model discovery: list the endpoint's own `/models`
  // inventory (Ollama and hosted providers alike) so the user picks a real
  // id instead of a hardcoded preset. Runs independently of the health check
  // hook — notably it does not depend on the selected model, so typing or
  // selecting a model never refetches the list.
  useEffect(() => {
    if (!open || !mentorEnabled) {
      modelsAbortRef.current?.abort()
      setAvailableModels([])
      return
    }
    modelsAbortRef.current?.abort()
    const controller = new AbortController()
    modelsAbortRef.current = controller
    // The previous endpoint's ids stop being offered as soon as the URL or
    // key changes; the bare input below stays usable while loading.
    setAvailableModels([])
    setCustomModelOpen(false)
    void listEndpointModels(aiBaseUrl, aiApiKey, controller.signal).then((ids) => {
      if (controller.signal.aborted) return
      setAvailableModels(ids)
      // Default an empty model to the first discovered id so the select
      // never sits blank after entering a URL. A non-empty value — typed
      // or previously selected — is never overwritten; read it fresh so a
      // model typed while the fetch was in flight wins.
      if (ids.length > 0 && useGraphStore.getState().settings.aiModel === '') {
        setSetting('aiModel', ids[0])
      }
    })
    // Native Ollama probe for the Pull affordance: only a server that
    // positively answers `/api/version` is offered Pull. Unreachable keeps
    // the previous value (an Ollama started mid-dialog keeps working);
    // proven non-Ollama hides Pull.
    void isOllamaNative(aiBaseUrl, controller.signal).then((native) => {
      if (!controller.signal.aborted && native !== null) setOllamaNative(native)
    })
    return () => {
      controller.abort()
    }
  }, [open, aiBaseUrl, aiApiKey, mentorEnabled, setSetting])

  return { availableModels, customModelOpen, setCustomModelOpen, ollamaNative }
}
