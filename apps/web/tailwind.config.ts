import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
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
      boxShadow: {
        panel: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
        card: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
        float: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)"
      }
    }
  },
  plugins: []
};

export default config;
