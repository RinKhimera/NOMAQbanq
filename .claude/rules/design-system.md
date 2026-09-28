---
paths:
  - "app/**"
  - "components/**"
  - "hooks/**"
---

# Design system

## Catalogue des composants partagés

**Avant de créer un composant, chercher ici.** Un besoin couvert par une
entrée s'y branche ; un besoin voisin l'étend (prop, variante) plutôt que de la
recopier. Un composant partagé ajouté entre dans ce tableau dans la même PR.

Deux niveaux : les **primitives** (`components/ui`, shadcn restylé, sans
logique métier) et les **composites** (`components/shared`, qui portent une
règle ou un gabarit commun à plusieurs zones).

| Besoin                           | Composant / module                                                             | Remarques                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| En-tête de page (un seul `h1`)   | `PageIntro` — `components/shared/page-intro.tsx`                               | Libellé, titre, description, lien retour, badge de compte, actions. Utilisable depuis un Server Component.                                              |
| État vide                        | `EmptyState` — `components/ui/empty-state.tsx`                                 | `size="compact"` dans une carte, une liste ou un panneau ; action par `action` ou `children`.                                                           |
| État d'erreur                    | `ErrorState` — `components/shared/error-state.tsx`                             | Réessai par `onRetry` ou `retryHref`. `variant="page"` pour un écran entier.                                                                            |
| `error.tsx` d'un segment         | `RouteError` — `components/shared/route-error.tsx`                             | Signale à Sentry et recharge complètement vers les sorties (`links`). Module séparé : Sentry ne doit pas entrer dans le graphe d'`ErrorState`.          |
| Squelettes                       | `components/ui/skeleton-patterns.tsx`                                          | `SkeletonText`, `SkeletonCard`, `SkeletonStatRow`, `SkeletonTable`, `PageSkeleton`. Doctrine : `loading-ui.md`.                                         |
| Confirmation                     | `ConfirmDialog` — `components/shared/confirm-dialog.tsx`                       | `onConfirm` async : ouvert et verrouillé jusqu'à l'issue, fermé au succès, laissé ouvert si elle renvoie `false`. `variant="destructive"`, `trigger`.   |
| Pastille de statut               | `StatusPill`, `RolePill`, `BannedPill` — `components/shared/status-pill.tsx`   | Une tonalité (`success`, `warning`, `danger`, `info`, `accent`, `admin`, `neutral`) et une icône. Statut d'examen : `ExamStatusBadge` sur la même base. |
| Accès (badge, carte)             | `AccessBadge` + `getAccessStatus`, `AccessCard` — `components/shared/payments` | Règle des 7 jours dans `getAccessStatus`, jamais recopiée. `AccessCard` : `size="compact"`, action selon l'état.                                        |
| Score : seuils et couleur        | `lib/score.ts`                                                                 | `PASS_THRESHOLD`, `scoreTone`, `isPassing`, `SCORE_TONE_TEXT`. Aucun seuil 80/60 écrit ailleurs.                                                        |
| Anneau de score                  | `ScoreRing` — `components/shared/score-ring.tsx`                               | Couleur tirée de `scoreTone`.                                                                                                                           |
| Montants, dates, durées          | `lib/format.ts`, `lib/currency.ts`, `lib/attempt-clock.ts`                     | `formatCurrency` (`whole` pour un total arrondi), dates ancrées sur l'heure de l'Est, `formatDuration`, `formatMinutesSeconds`, `centsToInputAmount`.   |
| Champ de recherche               | `SearchInput` — `components/shared/search-input.tsx`                           | Icône ou spinner (`isSearching`), `onValueChange`.                                                                                                      |
| Valeur débouncée                 | `useDebouncedValue` — `hooks/use-debounced-value.ts`                           | `onSettle` pour remettre la pagination à zéro au même instant.                                                                                          |
| Multi-sélection recherchable     | `MultiCombobox` — `components/shared/multi-combobox.tsx`                       | Options filtrées par l'appelant (local ou serveur), quota, « Tout effacer ».                                                                            |
| Pastille retirable               | `FilterChip` — `components/shared/filter-chip.tsx`                             |                                                                                                                                                         |
| Tableau de données, pagination   | `components/shared/data-table/`                                                | `DataTable`, `TablePagination`.                                                                                                                         |
| Redirection vers Stripe Checkout | `useCheckout` — `hooks/use-checkout.ts`                                        | `pendingProduct` pour le spinner du bon bouton.                                                                                                         |
| Avatar                           | `UserAvatar` — `components/shared/user-avatar.tsx`                             | Voir `data-layer.md`.                                                                                                                                   |
| Lien sans prefetch               | `LinkPendingIndicator` — `components/shared/link-pending-indicator.tsx`        | Voir `loading-ui.md`.                                                                                                                                   |

Annoncés par la refonte, créés avec leur premier écran consommateur, jamais
seuls : `StatBand`, `ValueBarChart`, `ColumnChart`, `FilterPanelButton` +
`FilterGroup`, `ColumnsMenu`, `SortHeader`, `StepTitle`, `SummaryPanel`.
