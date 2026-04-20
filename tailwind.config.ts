import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./node_modules/@heroui/react/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        "13": "repeat(13, minmax(0, 1fr))",
      },
      gridTemplateRows: {
        "13": "repeat(13, minmax(0, 1fr))",
      },
      colors: {
        parchment: { DEFAULT: "#f4e9d0", deep: "#e2d4b0", edge: "#c8b98f" },
        bone:      { DEFAULT: "#f6efe0", edge: "#d2c5a3", deep: "#c0b087" },
        ink:       { DEFAULT: "#1a1612", soft: "#3a2f25", faint: "rgba(26,22,18,0.55)" },
        gold:      { DEFAULT: "#c9a24a", hi: "#e8c872", lo: "#8b6a1e" },
        copper:    "#a3441e",
        silver:    "#c6c3bc",
        walnut:    { DEFAULT: "#3a2416", lo: "#2a1a10", hi: "#704b2b", gold: "#8b6a3e" },
        wine:      { DEFAULT: "#4d1219", deep: "#2c0a0d", mid: "#6b1a21" },
        navy:      { DEFAULT: "#0f1d33", deep: "#081525", mid: "#17294b" },
        forest:    "#214634",
      },
      fontFamily: {
        serif:  ['"Cormorant Garamond"', "Georgia", "serif"],
        sans:   ["Inter", "system-ui", "sans-serif"],
        mono:   ['"IBM Plex Mono"', "ui-monospace", "monospace"],
        script: ["Caveat", "cursive"],
      },
      boxShadow: {
        "die-cut": "inset 0 0 0 1px rgba(26,22,18,0.45), inset 0 0 0 2px #f4e9d0, inset 0 0 0 3px rgba(26,22,18,0.22), 0 2px 0 rgba(0,0,0,0.3), 0 10px 20px rgba(0,0,0,0.4)",
        "plaque":  "inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(0,0,0,0.18), inset 0 0 0 1px rgba(26,22,18,0.22), 0 2px 0 rgba(0,0,0,0.5), 0 8px 18px rgba(0,0,0,0.55)",
        "ticket":  "inset 0 0 0 1px rgba(26,22,18,0.15), 0 1px 0 rgba(255,255,255,0.12), 0 6px 14px rgba(0,0,0,0.5)",
      },
    },
  },
  darkMode: "class",
} satisfies Config;
