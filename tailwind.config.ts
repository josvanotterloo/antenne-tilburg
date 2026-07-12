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
        // Admin dark theme — see DESIGN.md §7. A slightly warmer, lighter-black
        // than the public canvas: the tool is a workspace, not the storefront.
        // Signal (shared) carries active nav + primary-action hover.
        "admin-bg": "#111318",
        "admin-surface": "#1C1F26",
        "admin-raised": "#242833",
        "admin-hairline": "#2A2D35",
        "admin-ink": "#F0F0F0",
        "admin-ink-muted": "#8A8F9C",
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
