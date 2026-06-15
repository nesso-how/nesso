// SPDX-License-Identifier: MIT
import { useState, useEffect } from 'react'
import {
  initWebLLM,
  LOCAL_MODEL_LABEL,
  LOCAL_MODEL_SIZE,
  localModelWeightsCached,
} from '@/llm/webllm'
import { useT } from '@/i18n'

interface Props {
  status: 'idle' | 'loading' | 'ready' | 'error'
  progress: number
  progressText: string
  error: string | null
}

export function LocalModelPanel({ status, progress, progressText, error }: Props) {
  const t = useT()
  const [cacheProbe, setCacheProbe] = useState<'unknown' | 'cached' | 'missing'>('unknown')

  useEffect(() => {
    let cancelled = false
    setCacheProbe('unknown')
    localModelWeightsCached()
      .then((y) => {
        if (!cancelled) setCacheProbe(y ? 'cached' : 'missing')
      })
      .catch(() => {
        if (!cancelled) setCacheProbe('missing')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (cacheProbe === 'cached' && status === 'idle') void initWebLLM()
  }, [cacheProbe, status])

  return (
    <div
      style={{
        border: '0.5px solid var(--line)',
        borderRadius: 12,
        padding: '16px',
        background: 'transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span style={{ font: "500 13px 'Inter', system-ui", color: 'var(--ink)' }}>
          {LOCAL_MODEL_LABEL}
        </span>
        <span style={{ font: "400 11px 'JetBrains Mono', ui-monospace", color: 'var(--ink-4)' }}>
          {LOCAL_MODEL_SIZE}
        </span>
        {status === 'ready' && (
          <span
            style={{
              marginLeft: 'auto',
              font: "500 10px 'JetBrains Mono', ui-monospace",
              color: 'var(--conf-5)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {t.settings.ai.localModel.ready}
          </span>
        )}
        {status === 'idle' && cacheProbe === 'cached' && (
          <span
            style={{
              marginLeft: 'auto',
              font: "500 10px 'JetBrains Mono', ui-monospace",
              color: 'var(--conf-5)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {t.settings.ai.localModel.saved}
          </span>
        )}
      </div>

      {status === 'idle' && cacheProbe === 'unknown' && (
        <p style={{ font: "400 12px/1.5 'Inter', system-ui", color: 'var(--ink-4)', margin: 0 }}>
          {t.settings.ai.localModel.checkingCache}
        </p>
      )}

      {status === 'idle' && cacheProbe === 'cached' && (
        <>
          <p
            style={{
              font: "400 12px/1.5 'Inter', system-ui",
              color: 'var(--ink-3)',
              margin: '0 0 8px',
            }}
          >
            {t.settings.ai.localModel.alreadyDownloaded}
          </p>
          <p style={{ font: "400 11px/1.45 'Inter', system-ui", color: 'var(--ink-4)', margin: 0 }}>
            {t.settings.ai.localModel.autoLoading}
          </p>
        </>
      )}

      {status === 'idle' && cacheProbe === 'missing' && (
        <>
          <p
            style={{
              font: "400 12px/1.5 'Inter', system-ui",
              color: 'var(--ink-3)',
              margin: '0 0 12px',
            }}
          >
            {t.settings.ai.localModel.description}
          </p>
          <button
            type="button"
            onClick={() => void initWebLLM()}
            style={{
              appearance: 'none',
              border: 0,
              background: 'var(--ink)',
              color: 'var(--paper)',
              font: "500 12.5px 'Inter', ui-sans-serif",
              padding: '9px 16px',
              borderRadius: 7,
              cursor: 'default',
            }}
          >
            {t.settings.ai.localModel.download}
          </button>
        </>
      )}

      {status === 'loading' && (
        <>
          <div
            style={{
              height: 4,
              borderRadius: 999,
              background: 'var(--line)',
              marginBottom: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.round(progress * 100)}%`,
                background: 'var(--accent)',
                borderRadius: 999,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span style={{ font: "400 11px 'JetBrains Mono', ui-monospace", color: 'var(--ink-4)' }}>
            {progressText || 'Loading…'}
          </span>
        </>
      )}

      {status === 'ready' && (
        <p style={{ font: "400 12px/1.5 'Inter', system-ui", color: 'var(--ink-3)', margin: 0 }}>
          {t.settings.ai.localModel.loaded}
        </p>
      )}

      {status === 'error' && (
        <>
          <p
            style={{
              font: "400 12px/1.5 'Inter', system-ui",
              color: 'var(--conf-1)',
              margin: '0 0 10px',
            }}
          >
            {error ?? 'Load failed.'}
          </p>
          <button
            type="button"
            onClick={() => void initWebLLM()}
            style={{
              appearance: 'none',
              border: '0.5px solid var(--line)',
              background: 'transparent',
              color: 'var(--ink-3)',
              font: "500 12px 'JetBrains Mono', ui-monospace",
              padding: '7px 12px',
              borderRadius: 7,
              cursor: 'default',
            }}
          >
            {t.settings.ai.localModel.retry}
          </button>
        </>
      )}
    </div>
  )
}
