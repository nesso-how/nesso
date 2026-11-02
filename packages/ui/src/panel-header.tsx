import type { ComponentProps, ReactNode } from 'react'
import { cn } from 'cn'

export function PanelHeader({
  actions,
  size = 'default',
  className,
  children,
  ...props
}: ComponentProps<'header'> & { actions: ReactNode; size?: 'default' | 'lg' }) {
  return (
    <header
      className={cn(
        'nesso-panel-header',
        size === 'lg' && 'h-[49px] pointer-coarse:h-[52px]',
        className,
      )}
      {...props}
    >
      {children}
      <div className="nesso-panel-actions">{actions}</div>
    </header>
  )
}
