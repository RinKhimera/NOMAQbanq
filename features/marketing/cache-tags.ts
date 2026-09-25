// Isolé de `cached.ts` : les actions qui invalident importent ces constantes
// sans charger `unstable_cache`, que les tests remplacent par un mock partiel
// de `next/cache`.
export const MARKETING_STATS_TAG = "marketing-stats"
export const PRODUCTS_TAG = "products"
