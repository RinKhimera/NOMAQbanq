---
paths:
  - "app/(marketing)/**"
  - "app/robots.ts"
  - "app/sitemap.ts"
  - "app/layout.tsx"
  - "components/seo/**"
---

# SEO Rules

**IMPORTANT - Metadata Server Components** : `metadata` et `generateMetadata` uniquement dans Server Components. Pages avec `"use client"` -> extraire le contenu dans `_components/*-page-client.tsx`.

**IMPORTANT - Claims éditoriaux** : taux de réussite / note → JAMAIS en dur dans le JSX ou les metadata. Source unique `MARKETING_CLAIMS` (`constants/index.tsx`) ; le taux affiché est calculé par `resolveSuccessRate` (`features/marketing/lib.ts`, bascule éditorial/calculé selon seuils de volume) et servi par `getCachedMarketingStats` (`features/marketing/cached.ts`). Formats fr-CA : « 85 % » (espace insécable), « 4,9/5 ».

**IMPORTANT - Aucun nombre de questions par domaine côté public** : `getMarketingStats` ne compte que le total. « 22 domaines » vient de `DOMAINS` (`constants/domains.ts`), liste figée qui porte aussi les slugs et objectifs des pages `domaines/[slug]` (générées au build, `dynamicParams = false`). Aucune page de la vitrine ne lit Neon au rendu : stats et produits passent par le cache (`features/marketing/cached.ts`).

| Fichier          | Role                                                             |
| ---------------- | ---------------------------------------------------------------- |
| `app/robots.ts`  | Regles crawl (bloque `/admin/`, `/tableau-de-bord/`, pages auth) |
| `app/sitemap.ts` | Pages publiques, dont les 22 pages domaine, avec priorites       |
| `app/layout.tsx` | Metadata globales + OpenGraph + Twitter cards                    |

Pattern pages marketing : Server Component qui lit le cache et compose les composites de `components/marketing/` (`MarketingHero`, `MarketingFigures`, `CtaBand`…) ; un îlot client seulement pour l'interactif (recherche, filtre). Catalogue : `design-system.md`.
