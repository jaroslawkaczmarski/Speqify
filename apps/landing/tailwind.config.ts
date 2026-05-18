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
} from "./src/tokens";

/**
 * Convergence -> Tailwind. The type scale, radius scale and breakpoints are
 * REPLACED (not extended) so only DESIGN.md values are reachable.
 */
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
    extend: {
      fontFamily,
      spacing,
      boxShadow,
      maxWidth,
    },
  },
  plugins: [],
} satisfies Config;
