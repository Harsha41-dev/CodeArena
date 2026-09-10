import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Instrument Serif", "Times New Roman", "serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      colors: {
        surface: {
          50: "var(--ca-bg)",
          100: "var(--ca-panel-muted)",
          900: "var(--ca-panel)",
          950: "var(--ca-bg)"
        },
        accent: {
          400: "var(--ca-accent-strong)",
          500: "var(--ca-accent)",
          600: "var(--ca-accent-strong)"
        },
        warn: {
          400: "var(--ca-warn)",
          500: "var(--ca-warn)"
        }
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "1.75rem"
      },
      boxShadow: {
        panel: "none",
        card: "none",
        float: "none"
      }
    }
  },
  plugins: []
};

export default config;
