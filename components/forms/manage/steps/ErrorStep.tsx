"use client"

import ThemeButton from "@/components/Theme/ThemeButton"

interface ErrorStepProps {
  errorMessage: string
  onRetry: () => void
}

export default function ErrorStep({ errorMessage, onRetry }: ErrorStepProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-8">
      <div className="text-center space-y-2">
        <div className="text-6xl mb-4">⚠️</div>
        <p className="text-lg text-gray-700 dark:text-gray-300 max-w-md">{errorMessage}</p>
      </div>

      <ThemeButton onClick={onRetry} className="mt-4">
        Try Again
      </ThemeButton>
    </div>
  )
}
