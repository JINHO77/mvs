import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1F2937",
        muted: "#6B7280",
        line: "#E5E7EB",
        paper: "#FAFAF7",
        brand: "#2563EB",
        mint: "#0F766E",
      },
    },
  },
  plugins: [],
};

export default config;
