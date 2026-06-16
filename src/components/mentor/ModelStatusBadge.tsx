// SPDX-License-Identifier: MIT
import { useT } from '@/i18n'
import type { OllamaModelStatus } from '@/lib/ollama'

interface Props {
  status: OllamaModelStatus
  model: string
  baseUrl: string
  pullProgress: number
  onPull: () => void
}

export function ModelStatusBadge({ status, model, baseUrl, pullProgress, onPull }: Props) {
  const t = useT()
  if (status === 'idle' || !model) return null
  const dot = (color: string) => (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 'var(--radius-circle)',
        background: color,
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )

  if (status === 'pulling') {
    return (
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            height: 3,
            borderRadius: 'var(--radius-pill)',
            background: 'var(--line)',
            overflow: 'hidden',
            marginBottom: 6,
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--accent)',
              width: `${Math.round(pullProgress * 100)}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 400,
            fontFamily: 'var(--font-mono)',
            color: 'var(--ink-4)',
          }}
        >
          {t.settings.ai.pulling(model, Math.round(pullProgress * 100))}
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        marginTop: 8,
        fontSize: '11px',
        fontWeight: 400,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {status === 'checking' && (
        <>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 'var(--radius-circle)',
              border: '1.5px solid var(--ink-4)',
              flexShrink: 0,
              animation: 'nx-spin 1s linear infinite',
              display: 'inline-block',
            }}
          />
          <span style={{ color: 'var(--ink-4)' }}>{t.settings.ai.status.checking}</span>
        </>
      )}
      {status === 'available' && (
        <>
          {dot('var(--conf-5)')}
          <span style={{ color: 'var(--conf-5)' }}>{t.settings.ai.status.available}</span>
        </>
      )}
      {status === 'unavailable' && (
        <>
          {dot('var(--conf-2)')}
          <span style={{ color: 'var(--ink-3)' }}>{t.settings.ai.status.notFound}</span>
          <button
            type="button"
            onClick={onPull}
            style={{
              appearance: 'none',
              border: '0.5px solid var(--accent)',
              background: 'transparent',
              color: 'var(--accent)',
              fontSize: '11px',
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'default',
            }}
          >
            {t.settings.ai.status.pull}
          </button>
        </>
      )}
      {status === 'error' &&
        (/localhost|127\.0\.0\.1/.test(baseUrl) ? (
          /localhost|127\.0\.0\.1/.test(window.location.hostname) ? (
            <>
              {dot('var(--ink-4)')}
              <span style={{ color: 'var(--ink-4)' }}>{t.settings.ai.status.ollamaNotRunning}</span>
              <code style={{ color: 'var(--ink-2)', fontSize: 'var(--text-xs)' }}>
                ollama serve
              </code>
            </>
          ) : (
            <>
              {dot('var(--conf-2)')}
              <span style={{ color: 'var(--ink-4)' }}>{t.settings.ai.status.corsBlocked}</span>
              <code style={{ color: 'var(--ink-2)', fontSize: 'var(--text-xs)' }}>
                OLLAMA_ORIGINS={window.location.origin}
              </code>
            </>
          )
        ) : (
          <>
            {dot('var(--ink-4)')}
            <span style={{ color: 'var(--ink-4)' }}>{t.settings.ai.status.unreachable}</span>
          </>
        ))}
    </div>
  )
}
