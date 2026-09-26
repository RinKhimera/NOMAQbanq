---
paths:
  - "app/(admin)/**"
  - "components/admin/**"
---

# Admin UI Rules

## Master-detail avec panel lateral

Pattern utilise dans `/admin/utilisateurs` et `/admin/examens`. Table cliquable -> panel Sheet (420px) avec details.

- URL deep linking: `?user=xxx` ou `?exam=xxx` pour partager un lien direct
- Composants: `Sheet` de shadcn/ui, animation `motion/react`
- **Etat derive de l'URL** : Pas de useState+useEffect. Voir `app/(admin)/admin/examens/page.tsx`.

## Détail d'une question : modale, pas panneau

Le détail d'une question s'ouvre dans `QuestionDetailModal`
(`components/admin/question-browser/`), partagée par le navigateur de questions
(`QuestionManageModal` : Modifier / Supprimer) et la constitution d'examen
(`QuestionSelectModal` : Ajouter / Retirer, sous quota). Plein écran sous
640 px, pied fixe : les actions restent visibles quelle que soit la longueur
de la question. Un nouvel usage fournit son pied, il ne recopie pas le contenu.

## Stat cards avec trends

Pattern `users-stats-row.tsx` et `exams-stats-row.tsx`: cartes KPI avec icone, valeur, trend %, subtitle.

- Couleurs: emerald, blue, amber, teal, slate
- Toujours reserver l'espace subtitle pour hauteur uniforme

## Filtres avances

Pattern `users-filter-bar.tsx`: recherche debounce + Select filters + DateRange picker avec presets.
