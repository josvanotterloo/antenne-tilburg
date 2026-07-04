import type { Config } from "tailwindcss";

// Design tokens — see DESIGN.md ("The Pirate Signal"). Monochrome canvas cut once
// by a single indigo signal; zero radius; flat, hairline-based depth.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0A0B0D",
        surface: "#15171B",
        "surface-raised": "#1E2127",
        ink: "#ECEDEF",
        "ink-muted": "#9BA1AC",
        hairline: "#2A2D34",
        signal: "#6B7DC9",
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      maxWidth: {
        prose: "72ch",
      },
    },
  },
  plugins: [],
};

export default config;
