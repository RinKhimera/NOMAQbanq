---
paths:
  - "app/**"
  - "components/**"
  - "hooks/**"
---

# Design system

Application dans le code de `DESIGN.md` (racine), la référence permanente :
jetons, typographie, ton, règles métier affichées. Le lire avant de créer ou
de modifier une interface. Ce fichier retient ce qu'on ne devine pas en lisant
le code et dont la violation fait diverger un écran du reste du site.

## Interdits

Un écran, un composant ou une classe qui emploie l'un de ces effets est à
reprendre, pas à conserver « en attendant » :

- **dégradés** (`bg-linear-*`, `bg-gradient-*`, `bg-clip-text` +
  `text-transparent`), sauf le logo ;
- **verre dépoli** (`backdrop-blur-*`, fonds translucides `bg-white/80`) et
  **orbes** décoratifs (`blur-3xl` sur une forme colorée) ;
- **soulèvement ou échelle au survol** (`hover:scale-*`, `hover:-translate-y-*`,
  `hover:shadow-*` qui grossit) : un survol change un fond ou une bordure,
  jamais la géométrie ;
- **emoji** dans l'interface, **tuiles d'icônes colorées** (carré teinté derrière
  une icône), animations d'entrée décoratives (`animate-fade-in-*`, `motion`
  pour faire apparaître un bloc) ;
- **ombres pour structurer** : la structure se fait par un filet de 1 px
  (`border-line`). Une ombre (`shadow-pop`) est réservée à ce qui flotte
  (dialogue, menu, popover, toast) ; `shadow-1` aux cartes.

Le verrou automatique (test d'architecture interdisant ces classes dans `app/`
et `components/`) arrive avec la contraction (#246). D'ici là, la revue tient
lieu de verrou.

## Jetons sémantiques obligatoires

Les couleurs viennent des jetons de `app/globals.css`, exposés en utilitaires
Tailwind. **Jamais** une couleur de palette brute (`text-blue-600`,
`bg-gray-100`, `border-slate-200`, `#2563eb`) dans un composant : elle ne suit
ni le thème sombre ni un changement de charte.

| Rôle                                  | Utilitaires                                                                                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonds : page, carte/champ, secondaire | `bg-background`, `bg-surface` (= `bg-card`), `bg-surface-2` (survol, piste)                                                                                                        |
| Texte : principal, courant, libellé   | `text-foreground` (= `text-ink`), `text-ink-2`, `text-ink-3` (= `text-muted-foreground`)                                                                                           |
| Texte décoratif ou désactivé          | `text-ink-4` — jamais pour un texte informatif (contraste insuffisant)                                                                                                             |
| Filets et bordures de contrôles       | `border-line` (= `border-border`), `border-line-strong` (= `border-input`)                                                                                                         |
| Action primaire, focus, sélection     | `bg-accent`/`bg-primary`, `text-accent-ink`, `bg-accent-soft`, `hover:bg-accent-hover`                                                                                             |
| Tonalités                             | `success`, `danger`, `warning`, `admin`, `objective`, chacune avec `-ink`, `-soft`, `-line` (`text-success-ink`, `bg-danger-soft`, `border-warning-line`)                          |
| Ombres                                | `shadow-1` (cartes), `shadow-2`, `shadow-pop` (flottants)                                                                                                                          |
| Rayons                                | `rounded-xs` 2 px badges · `rounded-sm` 3 px lettres A–E · `rounded-md` 4 px contrôles · `rounded-lg` 6 px cartes et dialogues · `rounded-full` avatar, switch, compteur seulement |
| Polices                               | `font-sans` (IBM Plex Sans, défaut), `font-serif` (Source Serif 4 : titres, vignettes, grands chiffres), `font-mono` (IBM Plex Mono : libellés, chiffres, chrono, ID)              |
| Anneau de focus                       | `focus-ring` (utilitaire sur le jeton `--focus-ring`), sur tout contrôle                                                                                                           |

Les alias shadcn (`bg-primary`, `text-muted-foreground`, `border-border`,
`bg-destructive`…) pointent vers ces jetons : ils restent valides jusqu'à la
contraction, mais un nouveau code emploie les noms sémantiques ci-dessus.
`font-display` est un alias transitoire de `font-serif`.

Le sens des couleurs est fixe (`DESIGN.md` §1) : émeraude = correct,
entraînement, actif ; rouge = incorrect, critique, suppression ; ambre =
marqué, expire bientôt, à vérifier ; violet = objectifs du CMC ; orange = zone
admin, navigation seulement. La correspondance tonalité → classes vit dans
`lib/tone.ts` ; aucune table de couleurs par tonalité ailleurs.

## Hauteurs de contrôles

Trois hauteurs : **32 px** (`sm`, tableaux denses et actions secondaires),
**40 px** (`default`, formulaires et barres de filtres), **48 px** (`lg`, action
primaire d'un héros ou d'un pied de formulaire). Bouton, champ, select,
combobox et onglets segmentés partagent la même échelle : dans une **barre de
filtres, tous les contrôles font 40 px**, sans exception. Cibles tactiles de
44 px minimum sous 768 px (zone de toucher étendue si le contrôle fait 32 px).

## Vocabulaire

Les libellés suivent `CONTEXT.md` : l'étudiant fait une **série** (jamais
« session d'entraînement » côté étudiant), passe un **examen blanc** et a une
**participation** (jamais « session d'examen »). Un **accès** (Examens,
Entraînement) se **prolonge** ; le **Pack Premium** octroie les deux. Casse de
phrase partout ; capitales réservées aux libellés mono (`font-mono text-xs
uppercase tracking-[0.06em]`). Vouvoiement, fr-CA, espace insécable avant « ! ? : ; »
et dans « Partie I », « 85 % ».

## Catalogue des composants partagés

**Avant de créer un composant, chercher ici.** Un besoin couvert par une
entrée s'y branche ; un besoin voisin l'étend (prop, variante) plutôt que de la
recopier. Un composant partagé ajouté entre dans ce tableau dans la même PR.

Deux niveaux : les **primitives** (`components/ui`, shadcn restylé, sans
logique métier) et les **composites** (`components/shared`, qui portent une
règle ou un gabarit commun à plusieurs zones).

| Besoin                           | Composant / module                                                             | Remarques                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| En-tête de page (un seul `h1`)   | `PageIntro` — `components/shared/page-intro.tsx`                               | Titre, description, icône, lien retour, actions. Utilisable depuis un Server Component.                                                                                                     |
| État vide                        | `EmptyState` — `components/ui/empty-state.tsx`                                 | `size="compact"` dans une carte, une liste ou un panneau ; action par `action` ou `children`.                                                                                               |
| État d'erreur                    | `ErrorState` — `components/shared/error-state.tsx`                             | Réessai par `onRetry` ou `retryHref`. `variant="page"` pour un écran entier.                                                                                                                |
| `error.tsx` d'un segment         | `RouteError` — `components/shared/route-error.tsx`                             | Signale à Sentry et recharge complètement vers les sorties (`links`). Module séparé : Sentry ne doit pas entrer dans le graphe d'`ErrorState`.                                              |
| Squelettes                       | `components/ui/skeleton-patterns.tsx`                                          | `SkeletonText`, `SkeletonCard`, `SkeletonStatRow`, `SkeletonTable`, `PageSkeleton`. Doctrine : `loading-ui.md`.                                                                             |
| Confirmation                     | `ConfirmDialog` — `components/shared/confirm-dialog.tsx`                       | `onConfirm` async : ouvert et verrouillé jusqu'à l'issue, fermé au succès, laissé ouvert si elle renvoie `false`. `variant="destructive"`, `trigger`.                                       |
| Pastille de statut               | `StatusPill`, `RolePill`, `BannedPill` — `components/shared/status-pill.tsx`   | Une tonalité (`success`, `warning`, `danger`, `info`, `accent`, `admin`, `neutral`) et une icône. Statut d'examen : `ExamStatusBadge` sur la même base.                                     |
| Accès (badge, carte)             | `AccessBadge` + `getAccessStatus`, `AccessCard` — `components/shared/payments` | Règle des 7 jours dans `getAccessStatus`, jamais recopiée. `AccessCard` : `size="compact"`, action selon l'état.                                                                            |
| Score : seuils et couleur        | `lib/score.ts`                                                                 | `PASS_THRESHOLD`, `scoreTone`, `isPassing`, `SCORE_TONE_TEXT`, `scoreTextClass`, `scoreSoftClass` (score retenu compris). Aucun seuil 80/60 écrit ailleurs, SQL compris.                    |
| Tonalité → couleur               | `lib/tone.ts`                                                                  | `TONE_TEXT`, `TONE_SOFT`, `TONE_COLOR` (variable CSS pour un SVG ou recharts). Aucune table de couleurs par tonalité ailleurs.                                                              |
| Anneau de score                  | `ScoreRing` — `components/shared/score-ring.tsx`                               | Couleur tirée de `scoreTone`.                                                                                                                                                               |
| Montants, dates, durées          | `lib/format.ts`, `lib/currency.ts`, `lib/attempt-clock.ts`                     | `formatCurrency` (`whole` pour un total arrondi), `formatPercent` (`digits`, `signed`), dates ancrées sur l'heure de l'Est, `formatDuration`, `formatMinutesSeconds`, `centsToInputAmount`. |
| Champ de recherche               | `SearchInput` — `components/shared/search-input.tsx`                           | Icône ou spinner (`isSearching`), `onValueChange`.                                                                                                                                          |
| Valeur débouncée                 | `useDebouncedValue` — `hooks/use-debounced-value.ts`                           | `onSettle` pour remettre la pagination à zéro au même instant.                                                                                                                              |
| Multi-sélection recherchable     | `MultiCombobox` — `components/shared/multi-combobox.tsx`                       | Options filtrées par l'appelant (local ou serveur), quota, « Tout effacer ».                                                                                                                |
| Pastille retirable               | `FilterChip` — `components/shared/filter-chip.tsx`                             |                                                                                                                                                                                             |
| Tableau de données, pagination   | `components/shared/data-table/`                                                | `DataTable`, `TablePagination`.                                                                                                                                                             |
| Redirection vers Stripe Checkout | `useCheckout` — `hooks/use-checkout.ts`                                        | `pendingProduct` pour le spinner du bon bouton.                                                                                                                                             |
| Avatar                           | `UserAvatar` — `components/shared/user-avatar.tsx`                             | Voir `data-layer.md`.                                                                                                                                                                       |
| Lien sans prefetch               | `LinkPendingIndicator` — `components/shared/link-pending-indicator.tsx`        | Voir `loading-ui.md`.                                                                                                                                                                       |
| Coquilles authentifiées          | `StudentShell`, `AdminShell` — `components/shared/shell/`                      | Cadre commun `ShellFrame` : SideNav dès 1024 px, Sheet en dessous (bascule en CSS). Liens et titre de page dans `lib/shell-navigation.ts`. Environnement de l'AdminBar lu par le layout.    |
| Logotype                         | `Logo` — `components/shared/shell/logo.tsx`                                    | Marque claire et sombre choisies par la classe `.dark`. `tagline`, `admin`.                                                                                                                 |
| Bascule de thème                 | `ThemeToggle` — `components/shared/theme-toggle.tsx`                           | Clair / Sombre / Système. Garde `useMounted` : hydratation.                                                                                                                                 |

Annoncés par la refonte, créés avec leur premier écran consommateur, jamais
seuls : `StatBand`, `ValueBarChart`, `ColumnChart`, `FilterPanelButton` +
`FilterGroup`, `ColumnsMenu`, `SortHeader`, `StepTitle`, `SummaryPanel`.
