/** @type {import('tailwindcss').Config} */
import { nextui } from "@nextui-org/react"
import { createThemes } from "tw-colors"

module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        custom: "0 15px 40px -15px rgba(0, 23, 185, 0.15)",
      },
    },
  },
  // darkMode: "class",
  plugins: [
    createThemes(
      {
        default: {
          primary: "#4D9CB9",
          secondary: "#EC8B33",
          white: "#ffffff",
          black: "#000000",
          default: {
            100: "#f7fafc",
            200: "#edf2f7",
            300: "#e2e8f0",
            400: "#cbd5e0",
            500: "#a0aec0",
            600: "#718096",
            700: "#4a5568",
            800: "#2d3748",
            900: "#1a202c",
          },
          success: "#000000",
          warning: "#f4ba41",
          danger: "#ec8b33",
          background: "#ffffff",
          foreground: "#112f45",
        },
        yhs: {
          primary: "#164D86",
          secondary: "#B12029",
          white: "#ffffff",
          black: "#000000",
          default: {
            100: "#f7fafc",
            200: "#edf2f7",
            300: "#e2e8f0",
            400: "#cbd5e0",
            500: "#a0aec0",
            600: "#718096",
            700: "#4a5568",
            800: "#2d3748",
            900: "#1a202c",
          },
          success: "#000000",
          warning: "#f4ba41",
          danger: "#ec8b33",
          background: "#ffffff",
          foreground: "#112f45",
        },
        kw: {
          primary: "#3C3C3C",
          secondary: "#C50032",
          white: "#ffffff",
          black: "#000000",
          default: {
            100: "#f7fafc",
            200: "#edf2f7",
            300: "#e2e8f0",
            400: "#cbd5e0",
            500: "#a0aec0",
            600: "#718096",
            700: "#4a5568",
            800: "#2d3748",
            900: "#1a202c",
          },
          success: "#000000",
          warning: "#f4ba41",
          danger: "#ec8b33",
          background: "#ffffff",
          foreground: "#112f45",
        },
        uco: {
          primary: "#164D86",
          secondary: "#C20F19",
          white: "#ffffff",
          black: "#000000",
          default: {
            100: "#f7fafc",
            200: "#edf2f7",
            300: "#e2e8f0",
            400: "#cbd5e0",
            500: "#a0aec0",
            600: "#718096",
            700: "#4a5568",
            800: "#2d3748",
            900: "#1a202c",
          },
          success: "#000000",
          warning: "#f4ba41",
          danger: "#ec8b33",
          background: "#ffffff",
          foreground: "#112f45",
        },
      },
      {
        produceThemeClass: (themeName) => `theme-${themeName}`,
      }
    ),
    nextui({
      layout: {
        radius: {
          small: "8px",
          medium: "12px",
          large: "16px",
        },
      },
    }),
  ],
}
