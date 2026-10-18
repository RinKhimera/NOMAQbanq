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

**IMPORTANT - Titres** : le gabarit racine ajoute « | NOMAQbanq » ; aucun `title` de page ne contient la marque. Un titre nomme ce que tapent les candidats (« EACMC », « QCM »), un mot-clé par titre, jamais l'ancien nom (seul le guide le porte). « partie 1 » survit pour la recherche, une fois, dans la description des pages clés (accueil, tarifs, évaluation, domaines) et dans les `keywords` du layout, jamais dans un titre ni dans le texte affiché. Pages domaine : titre dérivé de `DOMAINS` (« Cardiologie : QCM pour l'EACMC »). Verrou : `tests/marketing/metadata.test.ts`.

**IMPORTANT - Métadonnées d'une page** : `pageMetadata(MARKETING_PATHS.x, { title, description, ogTitle?, ogDescription?, ogImage? })` (`lib/seo.ts`) — canonical, `fr-CA` et un Open Graph complet sur la même URL, image du site comprise. Ne pas écrire `openGraph` à la main : une page qui le redéfinit remplace celui du layout au lieu de le compléter. Image du site : `app/opengraph-image.tsx` ; pages domaine : `domaines/[slug]/opengraph-image.tsx` (`ogImage: false`, car une clé `images` l'emporte sur le fichier du segment ; jamais `generateImageMetadata` : son `generateStaticParams` généré par Next entre en conflit avec celui du fichier, les images ne sont plus prérendues et répondent 404 en production — en dev tout est rendu à la demande, le défaut n'y paraît pas). Gabarit commun : `lib/og-card.tsx` (polices de `assets/fonts/`, jetons recopiés en hex : Satori ne lit pas les variables CSS). Le layout ne fixe que la carte Twitter : titre, description et image en sont repris de l'Open Graph de chaque page. Une image `opengraph-image` de segment sous un groupe de routes (`(marketing)`) est servie à `opengraph-image-<hash>` : ne jamais reconstruire son URL à la main (JSON-LD compris) ; à défaut, `SITE_OG_IMAGE`.

**URL et chemins** : chemins des pages publiques dans `MARKETING_PATHS` (`constants/index.tsx`) et `domainPath` (`constants/domains.ts`) ; URL absolue par `siteUrl(path)` (`lib/seo.ts`) — canonicals, sitemap, robots, JSON-LD, `llms.txt`. Jamais `https://nomaqbanq.ca` ni un chemin de la vitrine écrits en dur.

**Guide de l'EACMC** (`/eacmc-partie-1`) : le CMC a renommé l'examen « EACMC » (anciennement « EACMC, partie I ») ; le reste de la vitrine dit « EACMC ». L'ancien nom ne s'affiche qu'en rappel, « EACMC (anciennement Partie I) », dans le guide et dans la question de la FAQ qui définit l'examen (verrou `tests/marketing/faq-data.test.ts`). Il est la seule page qui vise « préparer l'EACMC » (`/fonctionnement` décrit le produit). Chaque fait renvoie à sa page mcc.ca ; frais, dates de session et taux de réussite à l'EACMC ne sont jamais recopiés. `GUIDE_REVIEWED_ON` (`_data/guide.ts`) ne change qu'après une relecture des faits contre mcc.ca : il est affiché et repris par le sitemap et le JSON-LD. Les questions de la FAQ sur l'examen renvoient chacune à une section du guide (`guideAnchor`, verrou `tests/marketing/faq-data.test.ts`). mcc.ca répond 403 à `curl` (Cloudflare) : vérifier une page ou un lien par WebFetch, pas par curl.

**Indexation d'un domaine** : `noindex: true` dans `DOMAINS` (aujourd'hui « Autres ») = page servie et liée, mais `noindex, follow`, absente du sitemap et du `llms.txt` (`INDEXED_DOMAINS`).

**Données structurées** : objets produits par les fonctions pures de `lib/seo.ts`, rendus par `JsonLd` (`components/seo/json-ld.tsx`) — `EducationalOrganization` et `WebSite` (sans `SearchAction` : la FAQ n'a pas de recherche par URL) dans le layout, `BreadcrumbList` sur les pages domaine (aligné sur le fil d'Ariane visible), `Product` + une `Offer` par produit sur Tarifs (prix du catalogue en cache), `FAQPage` sur la FAQ (`faqPageJsonLd`). `Article` sur le guide de l'EACMC (`articleJsonLd`, auteur = l'organisation : l'équipe reste anonyme).

| Fichier                 | Role                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `app/robots.ts`         | Regles crawl (bloque `/admin/`, `/tableau-de-bord/`, pages auth)                                                            |
| `app/sitemap.ts`        | Pages publiques, dont les pages domaine indexables, avec priorites                                                          |
| `app/llms.txt/route.ts` | Résumé du site pour les moteurs d'IA, généré au build depuis `DOMAINS`, les pages et la FAQ                                 |
| `app/layout.tsx`        | Metadata globales + OpenGraph + carte Twitter, JSON-LD de l'organisation et du site                                         |
| `lib/seo.ts`            | `pageMetadata`, `siteUrl`, `SITE_DESCRIPTION`, `SITE_OG_IMAGE`, fonctions JSON-LD (`offersJsonLd` rend `null` sans produit) |

Pattern pages marketing : Server Component qui lit le cache et compose les composites de `components/marketing/` (`MarketingHero`, `MarketingFigures`, `CtaBand`…) ; un îlot client seulement pour l'interactif (recherche, filtre). Catalogue : `design-system.md`.
