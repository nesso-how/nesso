// SPDX-License-Identifier: MIT
interface Props {
  size?: number
  color?: string
  accent?: string
}

export function SocratesGlyph({
  size = 32,
  color = 'currentColor',
  accent = 'var(--accent)',
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke={color}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Laurel crown */}
      <g stroke={accent} strokeWidth={1.1} opacity={0.95}>
        <path d="M7 11 q-2 -2 -2.5 -4.5" />
        <path d="M9 9.5 q-1.5 -2 -1.5 -4" />
        <path d="M11.5 8.5 q-0.5 -2 0 -3.8" />
        <path d="M25 11 q2 -2 2.5 -4.5" />
        <path d="M23 9.5 q1.5 -2 1.5 -4" />
        <path d="M20.5 8.5 q0.5 -2 0 -3.8" />
        <path d="M8 11 q8 -3 16 0" stroke={accent} fill="none" />
      </g>
      {/* Head outline */}
      <path
        d="M8.5 14 q-0.5 6 3 9.5 q4.5 4 9 0 q3.5 -3.5 3 -9.5"
        stroke={color}
        fill="var(--bg-elev)"
      />
      {/* Eyebrows */}
      <path d="M11.5 15 q1 -0.6 2.2 0" />
      <path d="M18.3 15 q1.2 -0.6 2.2 0" />
      {/* Eyes */}
      <circle cx="12.6" cy="16.6" r="0.7" fill={color} stroke="none" />
      <circle cx="19.4" cy="16.6" r="0.7" fill={color} stroke="none" />
      {/* Nose */}
      <path d="M16 17 q-0.4 1.6 0 3" />
      {/* Mouth */}
      <path d="M14.2 22 q1.8 0.5 3.6 0" />
      {/* Beard */}
      <path
        d="M11.5 20.5 q-1.5 4 1 7 q3.5 3 7 0 q2.5 -3 1 -7"
        fill="var(--paper-deep)"
        stroke={color}
      />
      {/* Beard texture */}
      <path d="M14 22.5 q-0.5 3 0 5.5" stroke={color} opacity={0.4} />
      <path d="M16 22.5 q0 3 0 6" stroke={color} opacity={0.4} />
      <path d="M18 22.5 q0.5 3 0 5.5" stroke={color} opacity={0.4} />
    </svg>
  )
}
