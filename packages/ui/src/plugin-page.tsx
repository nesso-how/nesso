import type { ComponentProps } from 'react'
import { cn } from 'cn'

export function PluginPage({ className, children, ...props }: ComponentProps<'main'>) {
  return (
    <main className={cn('nesso-plugin-page', className)} {...props}>
      {children}
    </main>
  )
}

export function PluginContent({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('nesso-plugin-content', className)} {...props}>
      {children}
    </div>
  )
}
