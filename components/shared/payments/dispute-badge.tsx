export type DisputeBadge = {
  label: string
  tone: "danger" | "success" | "muted"
}

/**
 * Libellé et ton du badge de litige. Un statut inconnu est traité comme « en
 * cours » : Stripe peut ajouter des statuts, et un litige invisible coûte plus
 * cher qu'un badge rouge de trop.
 */
export const disputeBadge = (
  status: string | null | undefined,
): DisputeBadge | null => {
  if (!status) return null
  switch (status) {
    case "won":
      return { label: "Litige gagné", tone: "success" }
    case "prevented":
      return { label: "Litige évité", tone: "success" }
    case "lost":
      return { label: "Litige perdu", tone: "muted" }
    case "warning_closed":
      return { label: "Enquête close", tone: "muted" }
    default:
      return { label: "Litige en cours", tone: "danger" }
  }
}
