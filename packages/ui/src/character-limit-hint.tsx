import { cn } from 'cn'

export function CharacterLimitHint({
  id,
  length,
  maxLength,
  remainingText,
  limitText,
  className,
}: {
  id: string
  length: number
  maxLength: number
  remainingText: (count: number) => string
  limitText: string
  className?: string
}) {
  const remaining = Math.max(0, maxLength - length)

  return (
    <p
      id={id}
      role="status"
      aria-atomic="true"
      className={
        remaining > 10
          ? 'sr-only'
          : cn(
              'text-xs leading-4',
              remaining === 0 ? 'text-foreground' : 'text-muted-foreground',
              className,
            )
      }
    >
      {remaining <= 10 ? (remaining === 0 ? limitText : remainingText(remaining)) : null}
    </p>
  )
}
