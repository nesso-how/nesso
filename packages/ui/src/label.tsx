import type { ComponentProps } from "react"
import { cn } from "cn"

function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-xs leading-4 text-muted-foreground select-none peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
