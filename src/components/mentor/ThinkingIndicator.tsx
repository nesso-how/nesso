// SPDX-License-Identifier: MIT

const BARS = [0, 120, 240, 360]

/** `label` (e.g. "thinking…") renders to the right once reasoning starts streaming. */
export function ThinkingIndicator({ label }: { label?: string } = {}) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: 14,
          padding: '4px 0',
          flexShrink: 0,
        }}
      >
        {BARS.map((delay) => (
          <span
            key={delay}
            style={{
              display: 'inline-block',
              width: 2,
              height: '100%',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--ink-3)',
              transformOrigin: 'center',
              animation: `nx-bars 1.1s cubic-bezier(0.45, 0, 0.55, 1) ${delay}ms infinite`,
            }}
          />
        ))}
      </div>
      {label && (
        <span
          style={{
            fontSize: '13px',
            fontFamily: 'var(--font-display)',
            color: 'var(--ink-4)',
            letterSpacing: '-0.005em',
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
