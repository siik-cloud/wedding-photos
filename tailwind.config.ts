import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ["var(--font-inter)",     "system-ui", "sans-serif"],
        serif: ["var(--font-cormorant)", "Georgia",   "serif"],
      },
      colors: {
        sage: {
          50:  "#f4f8f3",
          100: "#e6f0e4",
          200: "#cde1ca",
          300: "#a7c9a2",
          400: "#7aaa74",
          500: "#558d50",
          600: "#42713d",
          700: "#365a32",
          800: "#2d4929",
          900: "#263c23",
        },
      },
      borderRadius: {
        "3xl": "1.5rem",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
