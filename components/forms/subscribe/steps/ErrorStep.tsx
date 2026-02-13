"use client"

import ThemeButton from "@/components/Theme/ThemeButton"

interface ErrorStepProps {
  errorMessage: string
  onRetry: () => void
}

export default function ErrorStep({ errorMessage, onRetry }: ErrorStepProps) {
  return (
    <div className="flex flex-col space-y-6 py-8">
      <div className="text-center space-y-2">
        <p className="text-lg max-w-md">{errorMessage}</p>
      </div>

      <ThemeButton onPress={onRetry} className="mt-4">
        Try Again
      </ThemeButton>
    </div>
  )
}
