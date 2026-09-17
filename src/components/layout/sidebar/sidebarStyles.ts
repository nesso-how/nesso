// SPDX-License-Identifier: MIT

/** Shared sidebar primitives: icon button and uppercase section label styles. */
export const iconBtn: React.CSSProperties = {
  appearance: 'none',
  border: 0,
  background: 'transparent',
  width: 26,
  height: 26,
  borderRadius: 'var(--radius-sm)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink-3)',
  cursor: 'pointer',
}

export const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  fontFamily: 'var(--font-mono)',
  color: 'var(--ink-4)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}
