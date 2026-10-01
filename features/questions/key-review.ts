/**
 * Clé à vérifier et clé confirmée (`CONTEXT.md`). Module pur, partagé par le
 * DAL (sa forme SQL vit dans `dal.ts` et suit ces mêmes constantes) et les
 * écrans.
 */

export const KEY_CONFIRMATION_NOTE_MAX = 500

/** Réponses nouvelles qu'il faut au moins, en plus du doublement, pour qu'une confirmation tombe. */
export const KEY_CONFIRMATION_MIN_NEW_ANSWERS = 10

export type KeyConfirmation = {
  /** Epoch ms. */
  at: number
  /** Nom de l'admin ; `null` si son compte a disparu. */
  byName: string | null
  /** Réponses au moment de la confirmation. */
  answerCount: number
  note: string | null
}

/** Le nombre de réponses a doublé depuis la confirmation, avec au moins 10 nouvelles. */
export const hasDoubled = (answerCount: number, confirmedCount: number) =>
  answerCount >= 2 * confirmedCount &&
  answerCount - confirmedCount >= KEY_CONFIRMATION_MIN_NEW_ANSWERS

export type KeyReview = {
  toVerify: boolean
  /** Confirmation en vigueur, à afficher. */
  confirmation: KeyConfirmation | null
  /** Confirmation tombée alors que la répartition désigne toujours une autre option. */
  lapsedConfirmation: KeyConfirmation | null
}

/**
 * Une confirmation reste en vigueur tant que la répartition ne la contredit
 * pas après doublement des réponses ; tant qu'elle l'est, la question n'est
 * pas une clé à vérifier.
 */
export const keyReview = ({
  answerCount,
  keySuspect,
  confirmation,
}: {
  answerCount: number
  keySuspect: boolean
  confirmation: KeyConfirmation | null
}): KeyReview => {
  const lapsed =
    confirmation !== null &&
    keySuspect &&
    hasDoubled(answerCount, confirmation.answerCount)
  const inForce = confirmation !== null && !lapsed
  return {
    toVerify: keySuspect && !inForce,
    confirmation: inForce ? confirmation : null,
    lapsedConfirmation: lapsed ? confirmation : null,
  }
}
