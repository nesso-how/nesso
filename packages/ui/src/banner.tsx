import type { ComponentProps, ReactNode } from 'react'
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

export function BannerRow({ message, actions }: { message: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="min-w-0 flex-1">{message}</span>
      {actions && <span className="ml-auto flex flex-wrap items-center gap-2">{actions}</span>}
    </div>
  )
}

export function BannerDetails({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <details className="mt-1">
      <summary className="w-fit cursor-pointer text-[11px] leading-4 text-muted-foreground underline underline-offset-2">
        {label}
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  )
}
