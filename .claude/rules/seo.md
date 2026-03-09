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

| Fichier          | Role                                                     |
| ---------------- | -------------------------------------------------------- |
| `app/robots.ts`  | Regles crawl (bloque `/admin/`, `/dashboard/`, `/auth/`) |
| `app/sitemap.ts` | 9 pages publiques avec priorites                         |
| `app/layout.tsx` | Metadata globales + OpenGraph + Twitter cards            |

Pattern pages marketing : voir `app/(marketing)/tarifs/page.tsx` + `_components/tarifs-page-client.tsx`.
