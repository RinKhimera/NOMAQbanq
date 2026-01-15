import { format, formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

/**
 * Formate un montant en cents vers une devise lisible
 */
export const formatCurrency = (amountCents: number, currency = "CAD"): string => {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountCents / 100)
}

/**
 * Formate un timestamp en date lisible
 */
export const formatExpiration = (timestamp: number): string => {
  return format(new Date(timestamp), "d MMMM yyyy", { locale: fr })
}

/**
 * Formate un timestamp en temps relatif
 */
export const formatTimeRemaining = (timestamp: number): string => {
  return formatDistanceToNow(new Date(timestamp), {
    locale: fr,
    addSuffix: true,
  })
}

/**
 * Formate un timestamp en date courte
 */
export const formatShortDate = (timestamp: number): string => {
  return format(new Date(timestamp), "dd/MM/yyyy", { locale: fr })
}

/**
 * Formate un timestamp en date et heure
 */
export const formatDateTime = (timestamp: number): string => {
  return format(new Date(timestamp), "d MMM yyyy à HH:mm", { locale: fr })
}

/**
 * Formate un timestamp en heure uniquement (HH:mm)
 */
export const formatTimeOnly = (timestamp: number): string => {
  return format(new Date(timestamp), "HH:mm", { locale: fr })
}
