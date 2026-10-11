import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#10181d",
          900: "#162229",
          800: "#1e3038",
          700: "#2c4651",
          600: "#4d6570",
          500: "#6d828c",
          400: "#93a4ac",
        },
        canvas: "#f3f5f4",
        line: "#e1e7e4",
        pine: {
          50: "#f1f7f4",
          100: "#dcebe3",
          600: "#1f7a5a",
          700: "#176348",
          800: "#124e39",
        },
        clay: {
          50: "#fbf6f1",
          600: "#9a5b2d",
          700: "#7c4622",
        },
        sea: {
          50: "#f2f7f8",
          700: "#1d5560",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 29, 0.04), 0 8px 24px rgba(16, 24, 29, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
