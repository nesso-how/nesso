// SPDX-License-Identifier: MIT
import { useEffect, type CSSProperties, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  align?: 'center' | 'top'
  zIndex?: number
  backdropStyle?: CSSProperties
  contentStyle?: CSSProperties
}

export function ModalOverlay({
  open,
  onClose,
  children,
  align = 'center',
  zIndex = 75,
  backdropStyle,
  contentStyle,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex,
        background: 'rgba(20, 18, 14, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: align === 'top' ? 'flex-start' : 'center',
        justifyContent: 'center',
        paddingTop: align === 'top' ? 120 : 0,
        ...backdropStyle,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={contentStyle}
      >
        {children}
      </div>
    </div>
  )
}
