import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0052ff",
        "primary-light": "#3377ff",
        "primary-dark": "#003cc2",
        surface: "#12121a",
        "surface-2": "#1a1a2e",
        background: "#0a0a0f",
        foreground: "#e8e8ed",
        muted: "#8888a0",
        "muted-2": "#666680",
        "muted-3": "#444460",
        success: "#00e5a0",
        warning: "#ffaa00",
        danger: "#ff4466",
      },
      fontFamily: {
        mono: ["'SF Mono'", "'Fira Code'", "'JetBrains Mono'", "monospace"],
        sans: ["'Space Grotesk'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
