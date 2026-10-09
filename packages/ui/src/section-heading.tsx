import { Button } from './button'
import { cn } from 'cn'
import { ChevronDown } from 'lucide-react'
import type { ComponentProps } from 'react'

export function SectionHeading({ open, children, className, ...props }: ComponentProps<typeof Button> & { open: boolean }) {
  return (
    <Button
      {...props}
      variant="ghost"
      size="sm"
      aria-expanded={open}
      className={cn('nesso-section-heading w-full justify-start font-mono text-muted-foreground hover:bg-transparent hover:text-foreground active:bg-transparent', className)}
    >
      <ChevronDown className={open ? '' : '-rotate-90'} />{children}
    </Button>
  )
}
