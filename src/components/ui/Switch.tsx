// SPDX-License-Identifier: MIT
interface Props {
  value: boolean
  onChange: (value: boolean) => void
}

/** iOS-style on/off toggle. Use for true binary settings (Heatmap, Auto-flip);
 *  use SegmentedControl for fixed multi-choice instead. */
export function Switch({ value, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        appearance: 'none',
        cursor: 'default',
        padding: 0,
        position: 'relative',
        flexShrink: 0,
        width: 30,
        height: 17,
        borderRadius: 999,
        border: value ? '0.5px solid transparent' : '0.5px solid var(--line-strong)',
        background: value ? 'var(--ink-4)' : 'var(--paper-deep)',
        transition: 'background 150ms',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 1.5,
          left: value ? 14.5 : 1.5,
          width: 13,
          height: 13,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.22)',
          transition: 'left 150ms',
        }}
      />
    </button>
  )
}
