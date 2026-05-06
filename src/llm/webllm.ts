// SPDX-License-Identifier: MIT
import { CreateMLCEngine } from '@mlc-ai/web-llm'
import type { MLCEngine, InitProgressReport } from '@mlc-ai/web-llm'
import { useState, useEffect } from 'react'

export const LOCAL_MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'
export const LOCAL_MODEL_LABEL = 'Qwen2.5 1.5B'
export const LOCAL_MODEL_SIZE = '~1.1 GB'

export type WebLLMStatus = 'idle' | 'loading' | 'ready' | 'error'

interface WebLLMState {
  status: WebLLMStatus
  progress: number
  progressText: string
  error: string | null
  engine: MLCEngine | null
}

let state: WebLLMState = {
  status: 'idle',
  progress: 0,
  progressText: '',
  error: null,
  engine: null,
}

const listeners = new Set<() => void>()

function notify() {
  listeners.forEach(fn => fn())
}

function setState(patch: Partial<WebLLMState>) {
  state = { ...state, ...patch }
  notify()
}

export function getWebLLMState(): WebLLMState {
  return state
}

export function subscribeWebLLM(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export async function initWebLLM(): Promise<void> {
  if (state.status === 'ready' || state.status === 'loading') return
  setState({ status: 'loading', progress: 0, progressText: 'Initialising…', error: null })
  try {
    const engine = await CreateMLCEngine(LOCAL_MODEL_ID, {
      initProgressCallback: (report: InitProgressReport) => {
        setState({ progress: report.progress, progressText: report.text })
      },
    })
    setState({ status: 'ready', progress: 1, progressText: 'Ready', engine })
  } catch (e) {
    setState({ status: 'error', progress: 0, progressText: '', error: String(e), engine: null })
  }
}

export function getEngine(): MLCEngine | null {
  return state.engine
}

export function useWebLLM(): WebLLMState {
  const [s, setS] = useState<WebLLMState>(getWebLLMState)
  useEffect(() => subscribeWebLLM(() => setS({ ...getWebLLMState() })), [])
  return s
}
