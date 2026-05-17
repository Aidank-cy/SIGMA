import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "sigma-bg": "rgb(var(--sigma-bg) / <alpha-value>)",
        "sigma-surface": "rgb(var(--sigma-surface) / <alpha-value>)",
        "sigma-elevated": "rgb(var(--sigma-elevated) / <alpha-value>)",
        "sigma-text": "rgb(var(--sigma-text) / <alpha-value>)",
        "sigma-muted": "rgb(var(--sigma-muted) / <alpha-value>)",
        "sigma-line": "rgb(var(--sigma-line) / <alpha-value>)",
        "sigma-accent": "rgb(var(--sigma-accent) / <alpha-value>)",
        "sigma-success": "rgb(var(--sigma-success) / <alpha-value>)",
        "sigma-danger": "rgb(var(--sigma-danger) / <alpha-value>)",
        "sigma-warning": "rgb(var(--sigma-warning) / <alpha-value>)",
        "sigma-neutral": "rgb(var(--sigma-neutral) / <alpha-value>)",
        category: {
          politics: "#818cf8",
          finance: "#34d399",
          tech: "#c084fc",
          macro: "#fbbf24"
        },
        ink: "rgb(var(--sigma-text) / <alpha-value>)",
        mist: "rgb(var(--sigma-bg) / <alpha-value>)",
        line: "rgb(var(--sigma-line) / <alpha-value>)",
        signal: "rgb(var(--sigma-accent) / <alpha-value>)",
        alert: "rgb(var(--sigma-danger) / <alpha-value>)"
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "var(--font-noto-sans-sc)",
          "Inter",
          "Noto Sans SC",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ]
      },
      boxShadow: {
        apple: "0 22px 70px rgba(0, 0, 0, 0.16)",
        "apple-soft": "0 10px 30px rgba(0, 0, 0, 0.10)"
      },
      keyframes: {
        "sigma-float": {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -10px, 0)" }
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translate3d(0, 12px, 0) scale(0.98)" },
          "100%": { opacity: "1", transform: "translate3d(0, 0, 0) scale(1)" }
        },
        "modal-in": {
          "0%": { opacity: "0", transform: "translate3d(0, 10px, 0) scale(0.98)" },
          "100%": { opacity: "1", transform: "translate3d(0, 0, 0) scale(1)" }
        }
      },
      animation: {
        "sigma-float": "sigma-float 10s ease-in-out infinite",
        "toast-in": "toast-in 180ms ease-out",
        "modal-in": "modal-in 180ms ease-out"
      }
    }
  },
  plugins: []
};

export default config;
