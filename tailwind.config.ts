import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
        default: {
          100: "var(--color-default-100)",
          200: "var(--color-default-200)",
          300: "var(--color-default-300)",
          400: "var(--color-default-400)",
          500: "var(--color-default-500)",
          600: "var(--color-default-600)",
          700: "var(--color-default-700)",
          800: "var(--color-default-800)",
          900: "var(--color-default-900)",
        },
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
      },
      boxShadow: {
        custom: "0 15px 40px -15px rgba(0, 23, 185, 0.15)",
      },
    },
  },
  plugins: [],
}

export default config
