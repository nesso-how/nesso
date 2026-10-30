import { cn } from 'cn'

export function Spinner({ label, className }: { label: string; className?: string }) {
  return <div className={cn('flex items-center justify-center text-muted-foreground', className)} role="status">
    <span className="nesso-spinner" aria-hidden="true"><span /><span /><span /><span /></span>
    <span className="sr-only">{label}</span>
  </div>
}
