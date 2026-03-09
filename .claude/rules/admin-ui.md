---
paths:
  - "app/(admin)/**"
  - "components/admin/**"
---

# Admin UI Rules

## Master-detail avec panel lateral

Pattern utilise dans `/admin/users` et `/admin/exams`. Table cliquable -> panel Sheet (420px) avec details.

- URL deep linking: `?user=xxx` ou `?exam=xxx` pour partager un lien direct
- Composants: `Sheet` de shadcn/ui, animation `motion/react`
- **Etat derive de l'URL** : Pas de useState+useEffect. Voir `app/(admin)/admin/exams/page.tsx`.

## Stat cards avec trends

Pattern `users-stats-row.tsx` et `exams-stats-row.tsx`: cartes KPI avec icone, valeur, trend %, subtitle.

- Couleurs: emerald, blue, amber, teal, slate
- Toujours reserver l'espace subtitle pour hauteur uniforme

## Filtres avances

Pattern `users-filter-bar.tsx`: recherche debounce + Select filters + DateRange picker avec presets.
