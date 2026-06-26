// SPDX-License-Identifier: MIT
import { useT } from '@/i18n'

export function ExperimentalBadge() {
  const t = useT()
  return (
    <span
      style={{
        display: 'inline-block',
        flexShrink: 0,
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        fontWeight: 500,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--ink-4)',
        padding: '2px 7px',
        borderRadius: 'var(--radius-pill)',
        border: '0.5px solid var(--line-strong)',
        lineHeight: 1.4,
      }}
    >
      {t.mentor.experimental}
    </span>
  )
}
