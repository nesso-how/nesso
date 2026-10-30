import type { ComponentProps } from 'react'
import { cn } from 'cn'

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-6 min-w-6 items-center justify-center rounded-sm border border-border bg-canvas px-1.5 font-mono text-[11px] leading-none text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}
