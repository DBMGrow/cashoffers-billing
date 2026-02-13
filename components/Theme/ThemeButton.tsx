"use client"

import { ButtonHTMLAttributes, ReactNode } from "react"

interface ThemeButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color" | "onPress"> {
  color?: "primary" | "secondary" | "blur"
  variant?: "full"
  isDisabled?: boolean
  isLoading?: boolean
  onPress?: () => void
  children: ReactNode
  className?: string
}

export function ThemeButton({
  color = "primary",
  variant,
  isDisabled = false,
  isLoading = false,
  onPress,
  children,
  className = "",
  ...restProps
}: ThemeButtonProps) {
  // Base styles
  const baseStyles = "relative font-medium rounded-lg transition-all duration-200 px-4 py-2 text-sm active:scale-95"

  // Color variants
  const colorStyles = {
    primary: "text-white bg-primary shadow-md hover:brightness-110 active:brightness-95",
    secondary: "text-white bg-secondary shadow-md hover:brightness-110 active:brightness-95",
    blur: "text-black bg-white/50 backdrop-blur-sm hover:bg-white/60 active:bg-white/40",
  }

  // Variant styles
  const variantStyles = {
    full: "w-full",
  }

  // Disabled styles
  const disabledStyles = isDisabled || isLoading ? "opacity-50 cursor-not-allowed" : ""

  // Combined styles
  const buttonStyles = [
    baseStyles,
    colorStyles[color],
    variant ? variantStyles[variant] : "",
    disabledStyles,
    className,
  ]
    .filter(Boolean)
    .join(" ")

  const handleClick = () => {
    if (!isDisabled && !isLoading && onPress) {
      onPress()
    }
  }

  return (
    <button
      {...restProps}
      className={buttonStyles}
      onClick={handleClick}
      disabled={isDisabled || isLoading}
      type={restProps.type || "button"}
    >
      {/* Content */}
      <span className={isLoading ? "invisible" : ""}>{children}</span>

      {/* Loading spinner overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="animate-spin h-5 w-5 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
    </button>
  )
}

// Export as default for backward compatibility
export { ThemeButton as default }
