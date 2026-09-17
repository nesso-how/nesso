// SPDX-License-Identifier: MIT
import { useState } from 'react'
import { CloseButton } from '@/components/ui/CloseButton'
import { ModalOverlay } from '@/components/ui/ModalOverlay'
import { useT } from '@/i18n'
import { LearningSettings } from './LearningSettings'
import { AppearanceSection } from './settings/AppearanceSection'
import { AiSection } from './settings/AiSection'
import { PrivacySection } from './settings/PrivacySection'

type Tab = 'appearance' | 'learning' | 'ai' | 'privacy'
const ALL_TABS = ['appearance', 'learning', 'ai', 'privacy'] as const

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: Props) {
  const t = useT()
  const [tab, setTab] = useState<Tab>('appearance')

  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>
          <CloseButton large onClick={onClose} />
        </div>
        <div
          style={{
            width: 660,
            maxWidth: '94vw',
            background: 'var(--bg-card)',
            border: '0.5px solid var(--line)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            overflow: 'hidden',
            minHeight: 340,
            maxHeight: '76vh',
          }}
        >
          {/* Sidebar */}
          <div
            style={{
              width: 156,
              flexShrink: 0,
              borderRight: '0.5px solid var(--line)',
              background: 'var(--bg-elev)',
              padding: '20px 12px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-1)',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontWeight: 500,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--ink-4)',
                padding: '0 8px',
                marginBottom: 10,
              }}
            >
              {t.settings.title}
            </div>
            {ALL_TABS.map((tabId) => (
              <button
                key={tabId}
                onClick={() => setTab(tabId)}
                style={{
                  appearance: 'none',
                  border: 'none',
                  background: tab === tabId ? 'var(--paper-deep)' : 'transparent',
                  color: tab === tabId ? 'var(--ink)' : 'var(--ink-3)',
                  font: `${tab === tabId ? '500' : '400'} 13px 'Inter', system-ui`,
                  textAlign: 'left',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                  width: '100%',
                }}
              >
                {t.settings.tabs[tabId]}
              </button>
            ))}
          </div>

          {/* Content */}
          <div
            className="nesso-scrollbar"
            style={{ flex: 1, padding: '24px 28px 24px', overflowY: 'auto', minWidth: 0 }}
          >
            <div
              style={{
                marginBottom: 20,
                paddingBottom: 16,
                borderBottom: '0.5px solid var(--line)',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink)',
                }}
              >
                {t.settings.tabs[tab]}
              </span>
            </div>

            {tab === 'appearance' && <AppearanceSection />}

            {/* AiSection stays mounted while the dialog is open (visibility
                only) so tab switches neither abort the health check / model
                discovery in flight nor reset their state — exactly as when
                this logic lived in the dialog body. */}
            <div style={{ display: tab === 'ai' ? undefined : 'none' }}>
              <AiSection open={open} />
            </div>

            {tab === 'learning' && <LearningSettings />}

            {tab === 'privacy' && <PrivacySection />}
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}
