import type { Config } from "tailwindcss";
import {
  borderRadius,
  boxShadow,
  colors,
  fontFamily,
  fontSize,
  maxWidth,
  screens,
  spacing,
} from "@speqify/tokens";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    screens,
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      ...colors,
    },
    fontSize,
    borderRadius,
    extend: { fontFamily, spacing, boxShadow, maxWidth },
  },
  plugins: [],
} satisfies Config;
