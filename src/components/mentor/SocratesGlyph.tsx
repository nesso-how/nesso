// SPDX-License-Identifier: MIT
import type { CSSProperties } from 'react'
import socratesAvatar from './socrates-avatar.svg'

interface Props {
  size?: number
  /** Accessible name; omit when decorative next to a text label */
  title?: string
  style?: CSSProperties
}

export function SocratesGlyph({ size = 32, title, style }: Props) {
  return (
    <img
      src={socratesAvatar}
      width={size}
      height={size}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      draggable={false}
      style={{ display: 'block', ...style }}
    />
  )
}
