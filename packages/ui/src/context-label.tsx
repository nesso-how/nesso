import type { ComponentProps } from 'react'
import { cn } from 'cn'

export function ContextLabel({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('font-mono text-[11px] leading-4 text-muted-foreground', className)} {...props} />
}
