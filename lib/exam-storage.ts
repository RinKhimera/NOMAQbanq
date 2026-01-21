/**
 * Utilitaires pour la persistance des réponses d'examen dans localStorage
 * Permet de restaurer les réponses après un refresh accidentel
 */

const STORAGE_KEY_PREFIX = "exam_answers_"
const EXPIRY_HOURS = 24

interface StoredAnswers {
  answers: Record<string, string>
  savedAt: number
}

/**
 * Sauvegarde les réponses dans localStorage
 */
export const saveAnswersToStorage = (
  examId: string,
  answers: Record<string, string>,
): void => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${examId}`
    const data: StoredAnswers = {
      answers,
      savedAt: Date.now(),
    }
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    // localStorage peut échouer (quota, mode privé, etc.)
    console.warn("Échec de sauvegarde des réponses dans localStorage:", e)
  }
}

/**
 * Charge les réponses depuis localStorage
 * Retourne null si expirées ou inexistantes
 */
export const loadAnswersFromStorage = (
  examId: string,
): Record<string, string> | null => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${examId}`
    const data = localStorage.getItem(key)
    if (!data) return null

    const parsed: StoredAnswers = JSON.parse(data)

    // Vérifier l'expiration (24h)
    const expiryMs = EXPIRY_HOURS * 60 * 60 * 1000
    if (Date.now() - parsed.savedAt > expiryMs) {
      localStorage.removeItem(key)
      return null
    }

    return parsed.answers
  } catch (e) {
    console.warn("Échec de lecture des réponses depuis localStorage:", e)
    return null
  }
}

/**
 * Supprime les réponses du localStorage (après soumission réussie)
 */
export const clearAnswersFromStorage = (examId: string): void => {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${examId}`)
  } catch {
    // Ignorer les erreurs de suppression
  }
}
