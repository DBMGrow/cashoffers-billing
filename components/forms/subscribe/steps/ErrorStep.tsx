"use client"

import ThemeButton from "@/components/Theme/ThemeButton"

interface ErrorStepProps {
  errorMessage: string
  onRetry: () => void
  retryHref?: string | null
}

export default function ErrorStep({ errorMessage, onRetry, retryHref }: ErrorStepProps) {
  const buttonStyles =
    "relative font-medium rounded-md transition-all duration-200 px-4 py-2 text-sm active:scale-95 text-white bg-primary shadow hover:brightness-110 active:brightness-95 mt-4 inline-block text-center"

  return (
    <div className="flex flex-col space-y-6 py-8">
      <div className="text-center space-y-2">
        <p className="text-lg max-w-md">{errorMessage}</p>
      </div>

      {retryHref ? (
        <a href={retryHref} className={buttonStyles}>
          Try Again
        </a>
      ) : (
        <ThemeButton onPress={onRetry} className="mt-4">
          Try Again
        </ThemeButton>
      )}
    </div>
  )
}
