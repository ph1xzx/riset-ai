import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5dae2",
          300: "#b0bac9",
          400: "#8494ab",
          500: "#64768f",
          600: "#4f5e75",
          700: "#414d60",
          800: "#3a4352",
          900: "#2b313c",
          950: "#171b22",
        },
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#bcd3ff",
          300: "#8db4ff",
          400: "#598aff",
          500: "#3564ff",
          600: "#1f44f5",
          700: "#1834d1",
          800: "#1a2daa",
          900: "#1c2c85",
        },
        bone: {
          50: "#fbfaf7",
          100: "#f6f3ee",
          200: "#ece7de",
          300: "#ddd5c7",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
        display: ["var(--font-grotesk)", "Space Grotesk", "system-ui", "sans-serif"],
        mono: ["var(--font-plexmono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
