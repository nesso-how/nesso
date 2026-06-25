// SPDX-License-Identifier: MIT
import { NessoMark } from '@/components/layout/NessoMark'
import { ModalOverlay } from '@/components/ui/ModalOverlay'
import { APP_VERSION } from '@/data/appInfo'
import { useT } from '@/i18n'
import { hoverStyle } from '@/lib/hoverStyle'

interface Props {
  open: boolean
  onShowMeHow: () => void
  onSkipIntro: () => void
}

const btnBase = {
  appearance: 'none' as const,
  borderRadius: 'var(--radius-md)',
  fontSize: '14px',
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  padding: '10px 18px',
  cursor: 'pointer' as const,
}

export function WelcomeDialog({ open, onShowMeHow, onSkipIntro }: Props) {
  const t = useT()
  const w = t.onboarding.welcome

  return (
    <ModalOverlay open={open} onClose={onSkipIntro} zIndex={80}>
      <div
        role="dialog"
        aria-labelledby="onboarding-welcome-title"
        style={{
          width: 468,
          maxWidth: '92vw',
          background: 'var(--bg-card)',
          border: '0.5px solid var(--line)',
          borderRadius: 18,
          boxShadow: 'var(--shadow-lg)',
          padding: '40px 40px 30px',
          textAlign: 'center',
          filter: 'var(--drop-shadow-lg)',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 999,
            background: 'var(--highlight-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 10px',
            color: 'var(--ink)',
          }}
        >
          <NessoMark size={36} />
        </div>

        <div
          style={{
            fontSize: '12px',
            fontWeight: 400,
            fontFamily: 'var(--font-mono)',
            color: 'var(--ink-4)',
            marginBottom: 22,
          }}
        >
          {t.about.version(APP_VERSION)}
        </div>

        <h2
          id="onboarding-welcome-title"
          style={{
            margin: 0,
            fontSize: '28px',
            lineHeight: 1.18,
            fontWeight: 500,
            fontFamily: 'var(--font-display)',
            letterSpacing: 'var(--tracking-display)',
            color: 'var(--ink)',
          }}
        >
          {w.headlineLine1}
          <br />
          {w.headlineLine2Before}
          <em style={{ fontStyle: 'italic' }}>{w.headlineLine2Em}</em>
          {w.headlineLine2After}
        </h2>

        <p
          style={{
            margin: '16px auto 28px',
            maxWidth: 380,
            fontSize: '14px',
            lineHeight: 1.55,
            fontFamily: 'var(--font-sans)',
            color: 'var(--ink-3)',
          }}
        >
          {w.intro}
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onSkipIntro}
            style={{
              ...btnBase,
              border: '0.5px solid var(--line)',
              background: 'transparent',
              color: 'var(--ink-2)',
            }}
            {...hoverStyle(
              { background: 'var(--paper-deep)', color: 'var(--ink)' },
              { background: 'transparent', color: 'var(--ink-2)' },
            )}
          >
            {w.skipIntro}
          </button>
          <button
            type="button"
            onClick={onShowMeHow}
            style={{
              ...btnBase,
              border: '0.5px solid var(--ink-2)',
              background: 'var(--ink-2)',
              color: 'var(--paper)',
            }}
            {...hoverStyle(
              { background: 'var(--ink)', borderColor: 'var(--ink)' },
              { background: 'var(--ink-2)', borderColor: 'var(--ink-2)' },
            )}
          >
            {w.showMeHow}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
