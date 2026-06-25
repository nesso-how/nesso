// SPDX-License-Identifier: MIT
import type { CSSProperties, ReactNode } from 'react'
import { CloseButton } from '@/components/ui/CloseButton'
import { NessoMark } from '@/components/layout/NessoMark'
import {
  APP_VERSION,
  CHANGELOG_URL,
  DOCS_URL,
  LICENSE_URL,
  openExternal,
  REPO_URL,
  WEBSITE_URL,
} from '@/data/appInfo'
import { ModalOverlay } from '@/components/ui/ModalOverlay'
import { hoverStyle } from '@/lib/hoverStyle'
import { useT } from '@/i18n'

interface Props {
  open: boolean
  onClose: () => void
}

const linkRow: CSSProperties = {
  appearance: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-5)',
  width: '100%',
  padding: '11px 14px',
  border: 0,
  background: 'var(--bg-card)',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  color: 'var(--ink-2)',
  transition: 'background 0.12s, color 0.12s',
}

export function AboutDialog({ open, onClose }: Props) {
  const t = useT()

  const links: { label: string; url: string; icon: ReactNode }[] = [
    { label: t.about.links.github, url: REPO_URL, icon: <GithubIcon /> },
    { label: t.about.links.website, url: WEBSITE_URL, icon: <GlobeIcon /> },
    { label: t.about.links.documentation, url: DOCS_URL, icon: <BookIcon /> },
    { label: t.about.links.changelog, url: CHANGELOG_URL, icon: <ChangelogIcon /> },
    { label: t.about.links.license, url: LICENSE_URL, icon: <LicenseIcon /> },
  ]

  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div
        style={{
          position: 'relative',
          filter: 'var(--drop-shadow-lg)',
        }}
      >
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>
          <CloseButton large onClick={onClose} />
        </div>
        <div
          style={{
            width: 380,
            maxWidth: '94vw',
            background: 'var(--bg-card)',
            border: '0.5px solid var(--line)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px 28px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ color: 'var(--ink)', lineHeight: 0 }} aria-hidden>
            <NessoMark size={44} />
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: '20px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            Nesso
          </div>
          <span
            style={{
              marginTop: 8,
              fontSize: '12px',
              fontWeight: 400,
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink-4)',
            }}
          >
            {t.about.version(APP_VERSION)}
          </span>
          <p
            style={{
              margin: '14px 0 0',
              fontSize: '13px',
              fontWeight: 400,
              fontFamily: 'var(--font-sans)',
              color: 'var(--ink-3)',
              textAlign: 'center',
              lineHeight: 1.45,
              maxWidth: 300,
            }}
          >
            {t.about.tagline}
          </p>
          <div
            style={{
              width: '100%',
              marginTop: 22,
              padding: 1,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--line)',
            }}
          >
            <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {links.map(({ label, url, icon }, i) => (
                <button
                  key={url}
                  type="button"
                  style={{
                    ...linkRow,
                    borderTop: i > 0 ? '0.5px solid var(--line)' : 'none',
                  }}
                  onClick={() => void openExternal(url)}
                  {...hoverStyle(
                    { background: 'var(--paper-deep)', color: 'var(--ink)' },
                    { background: 'var(--bg-card)', color: 'var(--ink-2)' },
                  )}
                >
                  <span style={{ flexShrink: 0, lineHeight: 0 }} aria-hidden>
                    {icon}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ flexShrink: 0, lineHeight: 0, opacity: 0.55 }} aria-hidden>
                    <ExternalArrow />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

function GithubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0c4.42 0 8 3.58 8 8a8.01 8.01 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.04-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.27-.82 2.15 0 3.07 1.87 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.46-.55.38A8 8 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 4.2C7.3 3.6 6.3 3.3 5 3.3H2.5v8.4H5c1.3 0 2.3.3 3 .9 .7-.6 1.7-.9 3-.9h2.5V3.3H11c-1.3 0-2.3.3-3 .9Z" />
      <path d="M8 4.2v8.4" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6.5" />
      <path d="M1.5 8h13" />
      <path d="M8 1.5c1.9 1.7 2.9 4.1 2.9 6.5S9.9 12.8 8 14.5C6.1 12.8 5.1 10.4 5.1 8S6.1 3.2 8 1.5Z" />
    </svg>
  )
}

function ChangelogIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="2" width="10" height="12" rx="1.5" />
      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
    </svg>
  )
}

function LicenseIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2.5v11M4 4.5h8M5.5 13.5h5" />
      <path d="M4 4.5 2 9h4L4 4.5zM12 4.5 10 9h4l-2-4.5z" />
    </svg>
  )
}

function ExternalArrow() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 11 11 5M6 5h5v5" />
    </svg>
  )
}
