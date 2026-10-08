import type { ComponentProps } from 'react'
import { cn } from 'cn'

type BannerProps = ComponentProps<'div'> & {
  tone?: 'info' | 'warning' | 'error'
}

export function Banner({ tone = 'info', className, children, ...props }: BannerProps) {
  return (
    <div
      data-slot="banner"
      data-tone={tone}
      role={tone === 'info' ? 'status' : 'alert'}
      aria-atomic="true"
      className={cn(
        'rounded-sm border border-border bg-background px-3 py-2 text-xs leading-5 text-foreground',
        tone === 'warning' && 'border-node-border',
        tone === 'error' && 'border-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
