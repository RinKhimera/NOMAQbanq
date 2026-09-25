import { unstable_cache } from "next/cache"
import "server-only"
import { getAvailableProducts } from "@/features/payments/dal"
import { MARKETING_STATS_TAG, PRODUCTS_TAG } from "./cache-tags"
import { getMarketingStats } from "./dal"

// Lectures des pages publiques, servies depuis le cache de données Vercel :
// une visite anonyme (robots compris) ne doit pas réveiller la base Neon, dont
// chaque réveil coûte au moins 5 minutes de calcul facturées au quota.
// `unstable_cache` plutôt que `"use cache"`, qui exige `cacheComponents` pour
// toute l'app. Résultat sérialisé en JSON : ces formes n'ont ni Date ni Map.
//
// Le déploiement entre dans la clé : le cache survit aux déploiements, et la
// clé par défaut dérive du texte de la fonction, qu'enveloppe `cache()` de
// React rend identique pour toutes. Sans ce discriminant, une migration qui
// réécrit `questions` ou `products`, ou une forme de retour modifiée, serait
// servie périmée jusqu'à l'expiration.
const DEPLOYMENT = process.env.VERCEL_DEPLOYMENT_ID ?? "local"

export const getCachedMarketingStats = unstable_cache(
  getMarketingStats,
  ["marketing-stats", DEPLOYMENT],
  { tags: [MARKETING_STATS_TAG], revalidate: 604_800 },
)

// Un jour et non une semaine : les produits changent aussi par UPDATE SQL
// manuel, qu'aucune action ne suit. Un oubli de `vercel cache invalidate --tag
// products` affiche au pire l'ancien prix une journée.
export const getCachedAvailableProducts = unstable_cache(
  getAvailableProducts,
  ["available-products", DEPLOYMENT],
  { tags: [PRODUCTS_TAG], revalidate: 86_400 },
)
