import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import type { ComponentProps } from "react"

const buttonVariants = cva(
  "nesso-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border border-transparent px-2.5 text-xs leading-4 font-normal select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover",
        outline:
          "border-border bg-background hover:bg-accent active:bg-pressed",
        ghost:
          "hover:bg-accent active:bg-pressed",
      },
      size: {
        default:
          "min-h-9",
        sm: "min-h-7",
        icon: "size-9 p-0",
        "icon-sm": "size-7 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }

export function IconButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn('text-muted-foreground hover:bg-transparent hover:text-foreground active:bg-transparent', className)}
      {...props}
    />
  )
}
