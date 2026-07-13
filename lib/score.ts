// Arrondi half-up EXACT en arithmétique entière — parité stricte avec
// `round(correct * 100.0 / total)` (numeric SQL) des crons de clôture.
// `Math.round((correct / total) * 100)` en float diverge sur les demi-points
// (ex. 23/40 → 57.4999… → 57 au lieu de 58).
export const computeScorePercent = (correct: number, total: number): number =>
  total > 0 ? Math.floor((200 * correct + total) / (2 * total)) : 0
