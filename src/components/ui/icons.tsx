// SPDX-License-Identifier: MIT
import type { ReactNode } from 'react'

export type IconName =
  | 'copy'
  | 'cut'
  | 'duplicate'
  | 'trash'
  | 'paste'
  | 'add'
  | 'fit'
  | 'flip'
  | 'close'
  | 'chevron-left'
  | 'chevron-right'

const ICON_PATHS: Record<IconName, ReactNode> = {
  copy: (
    <>
      <rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.6" />
      <path d="M10 5.5V4a1.2 1.2 0 0 0-1.2-1.2H4A1.2 1.2 0 0 0 2.8 4v4.8A1.2 1.2 0 0 0 4 10h1.5" />
    </>
  ),
  cut: (
    <>
      <circle cx="4.2" cy="11.4" r="1.9" />
      <circle cx="4.2" cy="4.6" r="1.9" />
      <path d="M5.8 5.7L13 11.4M5.8 10.3L13 4.6" />
    </>
  ),
  duplicate: (
    <>
      <rect x="5.8" y="5.8" width="7.2" height="7.2" rx="1.6" />
      <rect x="2.9" y="2.9" width="7.2" height="7.2" rx="1.6" />
    </>
  ),
  trash: <path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.6 8a1 1 0 0 0 1 .9h2.8a1 1 0 0 0 1-.9l.6-8" />,
  paste: (
    <>
      <rect x="3.3" y="3" width="9.4" height="11" rx="1.6" />
      <rect x="5.6" y="1.8" width="4.8" height="2.6" rx="0.9" />
    </>
  ),
  add: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5.6v4.8M5.6 8h4.8" />
    </>
  ),
  fit: <path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" />,
  flip: <path d="M3.5 6.2h9l-2.4-2.4M12.5 9.8h-9l2.4 2.4" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  'chevron-left': <path d="M10 3.5L6 8l4 4.5" />,
  'chevron-right': <path d="M6 3.5L10 8l-4 4.5" />,
}

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

export function FolderIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 5.5a1 1 0 0 1 1-1h3.5l1.5 1.5h5a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5.5z" />
    </svg>
  )
}
