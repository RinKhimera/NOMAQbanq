// Client-safe : aucun import serveur. Convertit les rejets réseau d'un appel
// de Server Action en échec structuré, discriminable par les gardes existants
// (`!res.success` comme `"error" in res`).

export type ActionFailure = { success: false; error: string }

export const NETWORK_ERROR_MESSAGE =
  "Connexion perdue. Vérifiez votre réseau et réessayez."

const RETRY_DELAY_MS = 1000

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// `retries` est RÉSERVÉ aux actions idempotentes (upserts) : un « Failed to
// fetch » peut survenir alors que la requête a atteint le serveur, le retry
// ré-exécute donc l'action.
export async function callAction<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number },
): Promise<T | ActionFailure> {
  const retries = opts?.retries ?? 0
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch {
      if (attempt < retries) {
        await delay(RETRY_DELAY_MS)
        continue
      }
      return { success: false, error: NETWORK_ERROR_MESSAGE }
    }
  }
}
