// SPDX-License-Identifier: MIT
import type { CSSProperties } from 'react'

interface Props {
  size?: number
  /** Accessible name; omit when decorative next to a text label */
  title?: string
  style?: CSSProperties
}

export function SocratesGlyph({ size = 32, title, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: 'block', ...style }}
    >
      {title ? <title>{title}</title> : null}
      <ellipse cx="16" cy="10.46" rx="9.9" ry="9.46" fill="var(--mentor-avatar-skin)" />
      <path
        d="M10.47,3.62 C9.45,4.64 8.29,6.82 7.41,9.44 C6.83,10.9 6.54,12.06 6.39,12.93 L5.23,12.64 C5.38,10.75 5.96,8.28 6.83,6.38 C7.7,4.64 8.87,3.47 9.89,2.89 Z"
        fill="var(--mentor-avatar-hair)"
      />
      <path
        d="M21.53,3.62 C22.55,4.64 23.71,6.82 24.59,9.44 C25.17,10.9 25.46,12.06 25.61,12.93 L26.77,12.64 C26.62,10.75 26.04,8.28 25.17,6.38 C24.3,4.64 23.13,3.47 22.11,2.89 Z"
        fill="var(--mentor-avatar-hair)"
      />
      <path
        d="M7.6,12.5 Q12.22,14.25 16,14.05 Q19.78,14.25 24.4,12.5 C26.5,14.1 27.6,17.4 26.85,21 C26.5,23.9 24.2,27.4 16,28.1 C7.8,27.4 5.5,23.9 5.15,21 C4.4,17.4 5.5,14.1 7.6,12.5 Z"
        fill="var(--mentor-avatar-hair)"
      />
      <path
        d="M11.49,9.44 C12.36,8.64 13.74,8.28 14.84,8.79"
        fill="none"
        stroke="var(--mentor-avatar-hair)"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <path
        d="M17.16,8.79 C18.26,8.28 19.64,8.64 20.51,9.44"
        fill="none"
        stroke="var(--mentor-avatar-hair)"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <circle cx="13.45" cy="11.33" r="0.85" fill="var(--mentor-avatar-eye)" />
      <circle cx="13.68" cy="11.14" r="0.18" fill="var(--mentor-avatar-eye-highlight)" />
      <circle cx="18.55" cy="11.33" r="0.85" fill="var(--mentor-avatar-eye)" />
      <circle cx="18.78" cy="11.14" r="0.18" fill="var(--mentor-avatar-eye-highlight)" />
      <path
        d="M13.8,15.6 Q16,16.4 18.2,15.6"
        fill="none"
        stroke="var(--mentor-avatar-skin)"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </svg>
  )
}
