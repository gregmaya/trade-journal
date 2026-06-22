// src/utils/theme.js
// Shared theme tokens — single source of truth for all components

export const T = {
  bg: "var(--color-background-tertiary)",
  surface: "var(--color-background-secondary)",
  card: "var(--color-background-primary)",
  border: "var(--color-border-tertiary)",
  border2: "var(--color-border-secondary)",
  text: "var(--color-text-primary)",
  muted: "var(--color-text-secondary)",
  hint: "var(--color-text-tertiary)",
  green: "#10b981", greenBg: "rgba(16,185,129,0.12)",
  red: "#ef4444", redBg: "rgba(239,68,68,0.12)",
  yellow: "#f59e0b", yellowBg: "rgba(245,158,11,0.1)",
  indigo: "#6366f1", indigoBg: "rgba(99,102,241,0.12)",
};

export const btn = (variant="primary") => ({
  padding:"6px 14px", borderRadius:6, fontSize:12, fontWeight:500, cursor:"pointer", border:"0.5px solid",
  fontFamily:"var(--font-sans)",
  ...(variant==="primary" ? { background:T.text, color:T.card, borderColor:"transparent" }
    : variant==="ghost" ? { background:"transparent", color:T.muted, borderColor:T.border2 }
    : variant==="danger" ? { background:T.redBg, color:T.red, borderColor:"transparent" }
    : {})
});

export const Card = ({children, style={}}) => (
  <div style={{background:T.card, border:`0.5px solid ${T.border}`, borderRadius:"var(--border-radius-lg)", ...style}}>
    {children}
  </div>
);
