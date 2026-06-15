// SPDX-License-Identifier: MIT
import { useT } from '@/i18n'

/** Centered hint shown when the active graph has no concepts. Decorative only —
 *  pointer-events pass through so the underlying double-click still creates.
 *  Centered within the visible canvas area (insets exclude sidebar/inspector/bars). */
export function EmptyCanvasHint({
  topInset,
  bottomInset,
  leftInset,
  rightInset,
}: {
  topInset: number
  bottomInset: number
  leftInset: number
  rightInset: number
}) {
  const t = useT()
  return (
    <div
      style={{
        position: 'absolute',
        top: topInset,
        bottom: bottomInset,
        left: leftInset,
        right: rightInset,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: 340,
          padding: 24,
          opacity: 0.92,
        }}
      >
        {/* Ghost concept — echoes a real node with its dashed selection ring */}
        <div style={{ position: 'relative', marginBottom: 26 }}>
          <div
            style={{
              position: 'absolute',
              inset: -7,
              borderRadius: 999,
              border: '1px dashed var(--highlight)',
              opacity: 0.5,
            }}
          />
          <div
            style={{
              padding: '7px 18px',
              borderRadius: 999,
              border: '1px dashed var(--line-strong)',
              background: 'var(--bg-card)',
              font: '500 16px var(--font-display)',
              letterSpacing: '-0.005em',
              color: 'var(--ink-4)',
            }}
          >
            {t.canvas.emptyGhost}
          </div>
        </div>
        <div
          style={{
            font: '500 21px var(--font-display)',
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
            marginBottom: 8,
          }}
        >
          {t.canvas.emptyTitle}
        </div>
        <div
          style={{
            font: '400 14px var(--font-display)',
            lineHeight: 1.5,
            color: 'var(--ink-3)',
            marginBottom: 18,
          }}
        >
          {t.canvas.emptyDesc}
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            font: "500 11px 'JetBrains Mono', ui-monospace",
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--ink-4)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 9px',
              borderRadius: 6,
              border: '0.5px solid var(--line-strong)',
              background: 'var(--bg-elev)',
            }}
          >
            <span style={{ fontSize: 13 }}>⊕</span> {t.canvas.emptyCue}
          </span>
          <span style={{ opacity: 0.7 }}>{t.canvas.emptyCueTail}</span>
        </div>
      </div>
    </div>
  )
}
