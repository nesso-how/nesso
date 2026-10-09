import type { ComponentProps } from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "nesso-input h-9 w-full min-w-0 border border-input bg-background px-2.5 py-1 placeholder:text-muted-foreground focus-visible:border-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Input }
