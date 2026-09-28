/**
 * Tonalités sémantiques du design system (DESIGN.md §1) et leur rendu en
 * jetons. Seule table de correspondance tonalité → couleur : un score, une
 * pastille, un anneau ou un graphique la consomment, aucun n'en recopie une.
 *
 * `accent` désigne la teinte des objectifs du CMC (violet), `admin` celle de la
 * zone d'administration (orange, navigation seulement).
 */
export type Tone =
  "success" | "warning" | "danger" | "info" | "accent" | "admin" | "neutral"

/** Texte coloré sur fond neutre (score, montant, libellé). */
export const TONE_TEXT: Record<Tone, string> = {
  success: "text-success-ink",
  warning: "text-warning-ink",
  danger: "text-danger-ink",
  info: "text-accent-ink",
  accent: "text-objective",
  admin: "text-admin-ink",
  neutral: "text-ink-2",
}

/** Fond doux, texte et filet assortis (pastille, cellule de score). */
export const TONE_SOFT: Record<Tone, string> = {
  success: "bg-success-soft text-success-ink border-success-line",
  warning: "bg-warning-soft text-warning-ink border-warning-line",
  danger: "bg-danger-soft text-danger-ink border-danger-line",
  info: "bg-accent-soft text-accent-ink border-accent-soft",
  accent: "bg-objective-soft text-objective border-objective-soft",
  admin: "bg-admin-soft text-admin-ink border-admin-soft",
  neutral: "bg-surface-2 text-ink-2 border-line",
}

/** Couleur pour un attribut SVG ou un style inline (anneau, point, recharts). */
export const TONE_COLOR: Record<Tone, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--accent)",
  accent: "var(--objective)",
  admin: "var(--admin)",
  neutral: "var(--ink-4)",
}
