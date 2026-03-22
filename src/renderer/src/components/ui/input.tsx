import * as React from "react"
import { cn } from "@renderer/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <div className="spectral-thread relative">
        <input
          type={type}
          className={cn(
            "flex h-9 w-full rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-3 py-1 text-sm font-[var(--font-mono)] text-[var(--on-surface)] shadow-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            "ghost-border focus-visible:[outline:none]",
            "[font-family:var(--font-mono)]",
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
