/**
 * Refus d'une réponse dont le texte n'est plus une option de la question : la
 * page a été chargée avant une édition. Réessayer renverrait le même texte ;
 * seul un rechargement répare. Hors politique de la garde, et lu aussi par les
 * pages de passation : d'où ce module sans `server-only`.
 */
export const OPTION_CHANGED = "OPTION_CHANGED" as const

export const optionChanged = () => ({
  success: false as const,
  error:
    "Cette question a été modifiée depuis l'ouverture de la page. Rechargez-la pour répondre.",
  code: OPTION_CHANGED,
})

/** Message du toast de passation pour une réponse non enregistrée. */
export const answerNotSavedMessage = (refusal: {
  error?: string
  code?: string
}) =>
  refusal.code === OPTION_CHANGED && refusal.error
    ? refusal.error
    : "Réponse non enregistrée, réessayez."
