import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', "ui-monospace", "monospace"],
        body: ['"VT323"', "ui-monospace", "monospace"],
      },
      colors: {
        // Retro CRT-ish palette used across the HUD/menus.
        ink: "#0b1020",
        panel: "#141a2e",
        panelLight: "#1e2742",
        accent: "#facc15",
        accentDim: "#a8801a",
        frame: "#3b4a78",
        success: "#22c55e",
        danger: "#ef4444",
      },
      boxShadow: {
        pixel: "0 0 0 4px #0b1020, 0 0 0 8px #3b4a78",
        pixelSoft: "0 4px 0 0 rgba(0,0,0,0.4)",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        popIn: {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        blink: "blink 1s steps(2, start) infinite",
        floaty: "floaty 2.4s ease-in-out infinite",
        popIn: "popIn 0.18s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
