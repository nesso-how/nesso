// SPDX-License-Identifier: MIT

const BARS = [0, 120, 240, 360]

export function ThinkingIndicator() {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      height: 22, padding: '4px 0', flexShrink: 0,
    }}>
      {BARS.map(delay => (
        <span key={delay} style={{
          display: 'inline-block',
          width: 2, height: '100%', borderRadius: 2,
          background: 'var(--ink-3)',
          transformOrigin: 'center',
          animation: `nx-bars 1.1s cubic-bezier(0.45, 0, 0.55, 1) ${delay}ms infinite`,
        }} />
      ))}
    </div>
  )
}
