"use client"

interface SpinnerProps {
  size?: "sm" | "md" | "lg"
  color?: "primary" | "secondary" | "default"
  className?: string
}

export function Spinner({ size = "md", color = "primary", className = "" }: SpinnerProps) {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  }

  const colorClasses = {
    primary: "text-primary",
    secondary: "text-secondary",
    default: "text-default-500",
  }

  const combinedClasses = `${sizeClasses[size]} ${colorClasses[color]} ${className}`.trim()

  return (
    <svg
      className={`animate-spin ${combinedClasses}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
      role="status"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  )
}
