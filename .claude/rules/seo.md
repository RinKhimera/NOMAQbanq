---
paths:
  - "app/(marketing)/**"
  - "app/robots.ts"
  - "app/sitemap.ts"
  - "app/llms.txt/**"
  - "app/layout.tsx"
  - "components/seo/**"
  - "lib/seo.ts"
---

# SEO Rules

**IMPORTANT - Metadata Server Components** : `metadata` et `generateMetadata` uniquement dans Server Components. Pages avec `"use client"` -> extraire le contenu dans `_components/*-page-client.tsx`.

**IMPORTANT - Aucun chiffre éditorial** : pas de note moyenne (aucun système d'avis), pas de taux écrit à la main, pas de « première plateforme ». Tout chiffre public est compté. Le seul taux public est le « Taux de réussite aux examens blancs » (glossaire `CONTEXT.md`) : `resolveSuccessRate` (`features/marketing/lib.ts`) le rend formaté et arrondi vers le bas (le plancher se compare au taux exact : 69,5 % n'est pas publié), ou `null` sous le volume minimal ou le plancher de publication, et la vitrine n'affiche alors rien à sa place. Il se libelle toujours comme un taux d'examens blancs, jamais comme une réussite à l'EACMC, et n'entre pas dans les metadata (elles ne suivent pas le cache des stats). Chiffres publics : `publicFigures` (`components/marketing/marketing-figures.tsx`). Formats fr-CA : « 82 % » (espace insécable).

**IMPORTANT - Aucun nombre de questions par domaine côté public** : `getMarketingStats` ne compte que le total. « 22 domaines » vient de `DOMAINS` (`constants/domains.ts`), liste figée qui porte aussi les slugs et objectifs des pages `domaines/[slug]` (générées au build, `dynamicParams = false`). Aucune page de la vitrine ne lit Neon au rendu : stats et produits passent par le cache (`features/marketing/cached.ts`).

**IMPORTANT - Titres** : le gabarit racine ajoute « | NOMAQbanq » ; aucun `title` de page ne contient la marque. Un titre nomme ce que tapent les candidats (« EACMC Partie I », « QCM »), un mot-clé par titre ; « partie 1 » une fois dans la description des pages clés. Pages domaine : titre dérivé de `DOMAINS` (« Cardiologie : QCM pour l'EACMC Partie I »). Verrou : `tests/marketing/metadata.test.ts`.

**IMPORTANT - Métadonnées d'une page** : `pageMetadata(MARKETING_PATHS.x, { title, description, ogTitle?, ogDescription?, ogImage? })` (`lib/seo.ts`) — canonical, `fr-CA` et un Open Graph complet sur la même URL, image du site comprise. Ne pas écrire `openGraph` à la main : une page qui le redéfinit remplace celui du layout au lieu de le compléter. Image du site : `app/opengraph-image.tsx` ; pages domaine : `domaines/[slug]/opengraph-image.tsx` (`ogImage: false`, car une clé `images` l'emporte sur le fichier du segment ; texte alternatif par domaine via `generateImageMetadata`). Gabarit commun : `lib/og-card.tsx` (polices de `assets/fonts/`, jetons recopiés en hex : Satori ne lit pas les variables CSS). Le layout ne fixe que la carte Twitter : titre, description et image en sont repris de l'Open Graph de chaque page.

**URL et chemins** : chemins des pages publiques dans `MARKETING_PATHS` (`constants/index.tsx`) et `domainPath` (`constants/domains.ts`) ; URL absolue par `siteUrl(path)` (`lib/seo.ts`) — canonicals, sitemap, robots, JSON-LD, `llms.txt`. Jamais `https://nomaqbanq.ca` ni un chemin de la vitrine écrits en dur.

**Indexation d'un domaine** : `noindex: true` dans `DOMAINS` (aujourd'hui « Autres ») = page servie et liée, mais `noindex, follow`, absente du sitemap et du `llms.txt` (`INDEXED_DOMAINS`).

**Données structurées** : objets produits par les fonctions pures de `lib/seo.ts`, rendus par `JsonLd` (`components/seo/json-ld.tsx`) — `EducationalOrganization` et `WebSite` (sans `SearchAction` : la FAQ n'a pas de recherche par URL) dans le layout, `BreadcrumbList` sur les pages domaine (aligné sur le fil d'Ariane visible), `Product` + une `Offer` par produit sur Tarifs (prix du catalogue en cache), `FAQPage` sur la FAQ (`faqPageJsonLd`).

| Fichier                 | Role                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `app/robots.ts`         | Regles crawl (bloque `/admin/`, `/tableau-de-bord/`, pages auth)                                                            |
| `app/sitemap.ts`        | Pages publiques, dont les pages domaine indexables, avec priorites                                                          |
| `app/llms.txt/route.ts` | Résumé du site pour les moteurs d'IA, généré au build depuis `DOMAINS`, les pages et la FAQ                                 |
| `app/layout.tsx`        | Metadata globales + OpenGraph + carte Twitter, JSON-LD de l'organisation et du site                                         |
| `lib/seo.ts`            | `pageMetadata`, `siteUrl`, `SITE_DESCRIPTION`, `SITE_OG_IMAGE`, fonctions JSON-LD (`offersJsonLd` rend `null` sans produit) |

Pattern pages marketing : Server Component qui lit le cache et compose les composites de `components/marketing/` (`MarketingHero`, `MarketingFigures`, `CtaBand`…) ; un îlot client seulement pour l'interactif (recherche, filtre). Catalogue : `design-system.md`.
