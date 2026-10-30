import type { ComponentProps, ReactNode } from 'react'
import { cn } from 'cn'

export function PanelHeader({
  actions,
  className,
  children,
  ...props
}: ComponentProps<'header'> & { actions: ReactNode }) {
  return (
    <header className={cn('nesso-panel-header', className)} {...props}>
      {children}
      <div className="nesso-panel-actions">{actions}</div>
    </header>
  )
}
