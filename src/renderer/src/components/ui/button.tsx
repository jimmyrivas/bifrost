import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@renderer/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--on-surface-variant)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "ghost-border bg-transparent text-[var(--on-surface)] hover:bg-[var(--surface-bright)]/10",
        spectral:
          "ghost-border spectral-text hover:bg-[var(--surface-bright)]/10",
        destructive:
          "ghost-border text-[var(--error)] hover:bg-[var(--error)]/10",
        outline:
          "ghost-border text-[var(--on-surface-variant)] hover:bg-[var(--surface-bright)]/10 hover:text-[var(--on-surface)]",
        ghost:
          "text-[var(--on-surface-variant)] hover:bg-[var(--surface-bright)]/10 hover:text-[var(--on-surface)]",
        link: "text-[var(--on-surface)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
