/**
 * Drizzle enveloppe l'erreur pg (DrizzleQueryError → cause = DatabaseError),
 * parfois sur plusieurs niveaux : on remonte la chaîne `cause` (bornée) jusqu'au
 * premier `code` SQLSTATE. Source de vérité unique — ne pas retester `error.code`
 * en surface dans les actions (branche morte, cf. bug updateProfile 23505).
 */
export const getPgErrorCode = (error: unknown): string | undefined => {
  let cur: unknown = error
  for (let i = 0; i < 5 && cur; i++) {
    if (typeof cur === "object" && "code" in cur) {
      const code = (cur as { code?: unknown }).code
      if (typeof code === "string") return code
    }
    cur = (cur as { cause?: unknown }).cause
  }
  return undefined
}

export const isPgUniqueViolation = (error: unknown): boolean =>
  getPgErrorCode(error) === "23505"
