import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm charcoal "ink" scale used across the app
        ink: {
          50: "#faf9f5",
          100: "#f2ede3",
          200: "#e9e2d3",
          300: "#d8cfba",
          400: "#b3a88f",
          500: "#8a7f66",
          600: "#6b6250",
          700: "#524c3f",
          800: "#2c2f33",
          900: "#16181d",
          950: "#101114",
        },
        paper: "#fbfaf7",
        brand: {
          500: "#3564ff",
          600: "#2b57e8",
          700: "#1f43bd",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-grotesk)", "Space Grotesk", "system-ui", "sans-serif"],
        mono: ["var(--font-plexmono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
