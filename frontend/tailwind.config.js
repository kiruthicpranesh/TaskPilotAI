/** @type {import('tailwindcss').Config} */
export default {
  // Tell Tailwind to scan every TS/TSX file inside src/ so it can tree-shake
  // unused classes at build time and generate only what's actually used.
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand purple used for buttons, badges, and accents
        brand: {
          50:  "#faf5ff",
          100: "#f3e8ff",
          500: "#a855f7",
          600: "#9333ea",
          700: "#7e22ce",
        },
      },
      animation: {
        // Spin used by loading spinners throughout the app.
        // The comment below is intentional for interview readability:
        // Spinners also mask Render's cold-start delay (up to 60s on free tier)
        // so the user sees activity instead of a blank screen.
        "spin-slow": "spin 1.5s linear infinite",
      },
    },
  },
  plugins: [],
}
