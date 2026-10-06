import type { ComponentProps } from 'react'
import { cn } from 'cn'

type NoticeProps = ComponentProps<'div'> & {
  tone?: 'info' | 'warning' | 'error'
}

export function Notice({ tone = 'info', className, children, ...props }: NoticeProps) {
  return (
    <div
      data-slot="notice"
      data-tone={tone}
      role={tone === 'info' ? 'status' : 'alert'}
      aria-atomic="true"
      className={cn(
        'rounded-sm border px-3 py-2 text-xs leading-5 text-foreground',
        tone === 'info' ? 'bg-background' : 'bg-muted',
        tone === 'error' ? 'border-foreground' : 'border-border',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
