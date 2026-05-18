/**
 * Convergence design tokens — single source of truth.
 *
 * Transcribed verbatim from DESIGN.md front-matter. `tailwind.config.ts` consumes
 * this; do not redefine values elsewhere. Every color pair is WCAG 2.1 AA
 * contrast-validated (see DESIGN.md §Colors).
 */
export const colors = {
  primary: "#0F172A",
  "on-primary": "#FFFFFF",
  "primary-hover": "#1E293B",
  "primary-pressed": "#020617",
  secondary: "#475569",
  "on-secondary": "#FFFFFF",
  accent: "#DC2626",
  "on-accent": "#FFFFFF",
  "accent-hover": "#B91C1C",
  success: "#15803D",
  "on-success": "#FFFFFF",
  warning: "#B45309",
  "on-warning": "#FFFFFF",
  danger: "#B91C1C",
  "on-danger": "#FFFFFF",
  info: "#1D4ED8",
  "on-info": "#FFFFFF",
  neutral: "#F8FAFC",
  surface: "#FFFFFF",
  "on-surface": "#0F172A",
  "surface-muted": "#F1F5F9",
  "surface-sunken": "#E2E8F0",
  border: "#E2E8F0",
  "border-strong": "#CBD5E1",
  "border-focus": "#1D4ED8",
  muted: "#64748B",
  link: "#1D4ED8",
  "link-visited": "#7E22CE",
} as const;

const sans = "InterVariable, Inter, -apple-system, system-ui, sans-serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** [fontSize, { lineHeight, letterSpacing, fontWeight }] — Tailwind fontSize tuple. */
export const fontSize = {
  display: ["3.5rem", { lineHeight: "1.05", letterSpacing: "-0.025em", fontWeight: "700" }],
  h1: ["2.5rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
  h2: ["2rem", { lineHeight: "1.2", letterSpacing: "-0.015em", fontWeight: "600" }],
  h3: ["1.5rem", { lineHeight: "1.3", fontWeight: "600" }],
  h4: ["1.25rem", { lineHeight: "1.4", fontWeight: "600" }],
  "body-lg": ["1.125rem", { lineHeight: "1.6", fontWeight: "400" }],
  "body-md": ["1rem", { lineHeight: "1.6", fontWeight: "400" }],
  "body-sm": ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }],
  label: ["0.875rem", { lineHeight: "1.4", fontWeight: "500" }],
  button: ["1rem", { lineHeight: "1", fontWeight: "600" }],
  caption: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.02em", fontWeight: "500" }],
  code: ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }],
} as const;

export const borderRadius = {
  none: "0px",
  sm: "6px",
  md: "12px",
  lg: "20px",
  full: "9999px",
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  "2xl": "48px",
  "3xl": "64px",
  "4xl": "96px",
} as const;

/** Material-3-style elevation (DESIGN.md §Elevation). Decorative shadows forbidden. */
export const boxShadow = {
  "elevation-1": "0 1px 2px rgba(15, 23, 42, 0.06)",
  "elevation-2": "0 4px 12px rgba(15, 23, 42, 0.08)",
  "elevation-3": "0 12px 32px rgba(15, 23, 42, 0.16)",
  "elevation-4": "0 24px 48px rgba(15, 23, 42, 0.2)",
} as const;

/** min-width breakpoints (DESIGN.md §Grid and breakpoints). */
export const screens = {
  sm: "641px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
} as const;

export const fontFamily = { sans: [sans], mono: [mono] } as const;

export const maxWidth = { content: "1440px" } as const;
