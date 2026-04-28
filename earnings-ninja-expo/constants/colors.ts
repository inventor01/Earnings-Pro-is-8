export const colors = {
  background: "#0f172a",
  surface: "#1e293b",
  surfaceAlt: "#334155",
  border: "#334155",
  accent: "#facc15",
  accentDim: "#fbbf24",
  green: "#22c55e",
  red: "#ef4444",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  white: "#ffffff",
  black: "#000000",
} as const;

export type Colors = typeof colors;
