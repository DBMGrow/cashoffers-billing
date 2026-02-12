import { Button, extendVariants } from "@nextui-org/react"

export const ThemeButton = extendVariants(Button, {
  variants: {
    color: {
      primary: "text-white bg-primary font-medium rounded-lg shadow-md transition",
      secondary: "text-white bg-secondary font-medium rounded-lg shadow-md transition",
      blur: "text-black bg-white/50 backdrop-blur-sm font-medium rounded-lg transition",
    },
    isDisabled: {
      true: "opacity-50 cursor-not-allowed",
    },
    variant: {
      full: "w-full",
    },
  },
})
