/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // ── Charcoal / slate technical palette ──────────────────────────────
      colors: {
        // Primary surfaces — dark charcoal, used for sidebars, cards, navbar
        charcoal: {
          50:  "#f8f9fa",
          100: "#f1f3f5",
          200: "#e9ecef",
          300: "#dee2e6",
          400: "#ced4da",
          500: "#adb5bd",
          600: "#6c757d",
          700: "#495057",
          800: "#343a40",
          900: "#212529",
          950: "#141618",
        },
        // Accent — electric cyan/teal, used for interactive elements & badges
        accent: {
          50:  "#ecfeff",
          100: "#cffafe",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
        },
      },
      // ── Monospace font stack ─────────────────────────────────────────────
      // Used for code blocks, tool-call badges, task IDs, and status text.
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "Cascadia Code",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
        sans: [
          "Inter",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      // ── Background gradients ─────────────────────────────────────────────
      backgroundImage: {
        "grid-dark":
          "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid-24": "24px 24px",
      },
      animation: {
        // Spinners mask Render free-tier cold-start delay (~50s)
        "spin-slow": "spin 1.5s linear infinite",
        // Subtle pulse for the "Thinking…" badge
        "pulse-slow": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      boxShadow: {
        // Tight glow for accent elements on dark backgrounds
        "glow-cyan": "0 0 0 1px rgba(6,182,212,0.4), 0 0 12px rgba(6,182,212,0.15)",
      },
    },
  },
  plugins: [],
}
