import { cn } from 'cn'
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

export function ListRow({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('group flex min-h-14 items-center gap-1 rounded-sm hover:bg-accent has-[:focus-visible]:bg-accent', className)}>{children}</div>
}

export function ListRowButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn('min-w-0 flex-1 rounded-sm px-2.5 py-2 text-left', className)} {...props} />
}

export function ListRowTitle({ active, className, children }: { active?: boolean; className?: string; children: ReactNode }) {
  return <span className={cn('block text-[13px] leading-[19px] break-words', active && 'font-medium', className)}>{children}</span>
}

export function ListRowDetail({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('mt-[3px] block font-mono text-[10px] leading-[14px] text-muted-foreground', className)}>{children}</span>
}

export function RevealActions({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex shrink-0 items-center opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 has-[button[data-popup-open]]:opacity-100 [@media(pointer:coarse)]:opacity-100', className)}>{children}</div>
}

export function Field({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('nesso-field', className)}>{children}</div>
}

export function FieldHint({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('nesso-field-hint', className)} {...props} />
}
