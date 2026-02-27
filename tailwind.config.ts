import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b0c10",
        slate: "#111827",
        ash: "#f8fafc",
        accent: "#e2a84b",
        ocean: "#1b6ca8"
      }
    }
  },
  plugins: []
};

export default config;
