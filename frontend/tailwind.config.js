// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bgCanvas: "#F6F4EE",
        ink: "#1A1A1A",
        structural: "#D8D4CB",
        coral: "#D96C60",
      },
      fontFamily: {
        serif: ["Cambria", "Georgia", "serif"],
        sans: ["Calibri", "Inter", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
}