import { unstable_isUnrecognizedActionError } from "next/navigation"
import { toast } from "sonner"

// Client-safe : aucun import serveur. Convertit les rejets réseau d'un appel
// de Server Action en échec structuré, discriminable par les gardes existants
// (`!res.success` comme `"error" in res`).

export type ActionFailure = { success: false; error: string }

export const NETWORK_ERROR_MESSAGE =
  "Connexion perdue. Vérifiez votre réseau et réessayez."

export const DEPLOY_SKEW_MESSAGE =
  "Une nouvelle version de l'application est disponible. Rechargez la page pour continuer."

const RETRY_DELAY_MS = 1000

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Deploy skew : le bundle périmé POSTe un ID d'action inconnu du nouveau
// serveur — retenter est inutile par construction, seul un rechargement
// répare. Toast émis ICI (exception à « les toasts vivent dans les pages ») :
// plusieurs call sites toastent un message métier hardcodé qui masquerait le
// remède. `id` fixe → dédupliqué, `duration: Infinity` → persiste jusqu'au
// rechargement.
const notifyDeploySkew = () => {
  toast.error(DEPLOY_SKEW_MESSAGE, {
    id: "deploy-skew",
    duration: Infinity,
    action: { label: "Recharger", onClick: () => window.location.reload() },
  })
}

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
    } catch (err) {
      if (unstable_isUnrecognizedActionError(err)) {
        notifyDeploySkew()
        return { success: false, error: DEPLOY_SKEW_MESSAGE }
      }
      if (attempt < retries) {
        await delay(RETRY_DELAY_MS)
        continue
      }
      return { success: false, error: NETWORK_ERROR_MESSAGE }
    }
  }
}
