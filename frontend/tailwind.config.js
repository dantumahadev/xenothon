/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        astra: {
          primary:   "#0ea5e9",
          secondary: "#38bdf8",
          accent:    "#10b981",
          danger:    "#ef4444",
          warning:   "#f59e0b",
          dark:      "#0f172a",
          card:      "rgba(255,255,255,0.75)",
          bg:        "#f0f4f8",
          border:    "rgba(14,165,233,0.14)",
          muted:     "#64748b",
          surface:   "rgba(255,255,255,0.88)",
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
