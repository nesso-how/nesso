import type { ComponentProps } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from 'cn'

export function PanelToggle({ side, open, className, ...props }: ComponentProps<'button'> & { side: 'left' | 'right'; open: boolean }) {
  const Icon = (side === 'left') === open ? ChevronLeft : ChevronRight

  return (
    <button
      type="button"
      className={cn('panel-toggle', className)}
      data-side={side}
      aria-expanded={open}
      {...props}
    >
      <Icon aria-hidden="true" />
    </button>
  )
}
