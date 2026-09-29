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

Utilitaires de la vitrine (`app/globals.css`) : `bg-dots`, `bg-dots-fade`
(trame de points, contenu à positionner au-dessus du pseudo-élément) et
l'échelle `type-display`, `type-h1` … `type-h4`, `type-body-lg`,
`type-label`, réduite sous 1024 et 768 px.

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

La zone de 44 px appartient au contrôle lui-même : une enveloppe plus grande ne
reçoit pas le clic. Étendre par un pseudo-élément du bouton
(`relative max-md:after:absolute max-md:after:-inset-2.5 max-md:after:content-['']`).

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

| Besoin                             | Composant / module                                                                                      | Remarques                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| En-tête de page (un seul `h1`)     | `PageIntro` — `components/shared/page-intro.tsx`                                                        | Libellé mono (`eyebrow`), titre serif, description, lien retour, actions (pleine largeur sous 768 px). Sans icône. Utilisable depuis un Server Component.                                                                                                                                                   |
| État vide                          | `EmptyState` — `components/ui/empty-state.tsx`                                                          | `size="compact"` dans une carte, une liste ou un panneau ; action par `action` ou `children`.                                                                                                                                                                                                               |
| État d'erreur                      | `ErrorState` — `components/shared/error-state.tsx`                                                      | Réessai par `onRetry` ou `retryHref`. `variant="page"` pour un écran entier.                                                                                                                                                                                                                                |
| `error.tsx` d'un segment           | `RouteError` — `components/shared/route-error.tsx`                                                      | Signale à Sentry et recharge complètement vers les sorties (`links`). Module séparé : Sentry ne doit pas entrer dans le graphe d'`ErrorState`. `useReportRouteError` seul pour un `error.tsx` au rendu propre (500 de la racine).                                                                           |
| Squelettes                         | `components/ui/skeleton-patterns.tsx`                                                                   | `SkeletonText`, `SkeletonCard`, `SkeletonStatRow`, `SkeletonTable`, `PageSkeleton` ; `PassationSkeleton` (`components/quiz/session/`) pour une page de passation plein écran. Doctrine : `loading-ui.md`.                                                                                                   |
| Confirmation                       | `ConfirmDialog` — `components/shared/confirm-dialog.tsx`                                                | `onConfirm` async : ouvert et verrouillé jusqu'à l'issue, fermé au succès, laissé ouvert si elle renvoie `false`. `variant="destructive"`, `trigger`, `cancelLabel`. Contrôlé sans `trigger`, rend le focus à l'élément qui l'a ouvert.                                                                     |
| Carte de question, choix A–E       | `QuestionCard`, `AnswerOptionList` / `AnswerOption`, `RevealPanels` — `components/quiz/question-card/`  | `exam` (passation, révélation tuteur), `review` (correction repliable), `default` (liste admin). Choix réutilisables hors carte ; `data-state` sur chaque choix. Explication ouverte et Références fermées, en correction seulement.                                                                        |
| Navigateur de questions            | `NavigatorPanel`, `NavigatorSheet`, `passationCells` / `correctionCells` — `components/quiz/navigator/` | La page pose la colonne de 300 px (`lg:block`) ; le Sheet et son déclencheur « Questions » servent sous 1024 px. `handsOffFocus` quand la page déplace elle-même le focus après le choix (correction).                                                                                                      |
| Résultats d'une tentative          | `SessionResults`, `resultsByDomain` — `components/quiz/results/session-results.tsx`                     | Bilan (anneau `ScoreRing`, verdict `h1`, compteurs, percentile, `eyebrow`, `actions`, `backHref`), résultats par domaine (examen), filtre Toutes / Incorrectes / Marquées (`flaggedIds`), correction repliable et navigateur. `summary={false}` quand la page porte son propre bilan (évaluation gratuite). |
| Barre de passation                 | `SessionHeader` — `components/quiz/session/session-header.tsx`                                          | `h1` de la page (`titleAs="p"` dans une démo), chrono à paliers (`zone` + `EXAM_ZONES` / `EVALUATION_ZONES` de `lib/attempt-clock.ts`), collante sous `--shell-offset` en z-10 ; `sticky={false}` quand la page pose elle-même la barre.                                                                    |
| Passation (moteur)                 | `QuizRunner` — `components/quiz/runner/quiz-runner.tsx`                                                 | Plein écran (groupe `(passation)`), centré à 1160 px. Porte lui-même l'alerte hors ligne (`useOnline`), l'alerte « moins de 5 min » et le dialogue non fermable `TimeUpDialog` (auto-soumission, relance) ; `banners` pour les alertes de la page (reprise).                                                |
| État d'un examen dans la liste     | `lib/exam-list.ts`                                                                                      | `openExamState` (temps écoulé, en pause, en cours, ouvert, réservé, soumis) et son tri, `shownRemainingMs`, `closesBeforeBudget`, `examListStats` (retenu hors moyenne), `pastScoreState`, `groupByMonth`. `now` toujours en paramètre.                                                                     |
| Connexion du navigateur            | `useOnline` — `hooks/use-online.ts`                                                                     | `true` au rendu serveur et à l'hydratation.                                                                                                                                                                                                                                                                 |
| Pastille de statut                 | `StatusPill`, `RolePill`, `BannedPill` — `components/shared/status-pill.tsx`                            | Une tonalité (`success`, `warning`, `danger`, `info`, `accent`, `admin`, `neutral`) et une icône. Statut d'examen : `ExamStatusBadge` sur la même base.                                                                                                                                                     |
| Accès (badge, carte)               | `AccessBadge` + `getAccessStatus`, `AccessCard` — `components/shared/payments`                          | Règle des 7 jours dans `getAccessStatus`, jamais recopiée ; module non client, appelable d'un Server Component. `AccessCard` : `size="compact"`, action selon l'état, `inactiveNote` (accès expiré, prix d'appel).                                                                                          |
| Paywall d'une page                 | `AccessPaywall` — `components/shared/payments/access-paywall.tsx`                                       | Sans accès : présentation, prix d'appel (`priceFromCents`, lu par `cheapestMonthly`), « Voir les tarifs » ; échu (`expiredAt`) : « Votre accès … a expiré le … », « Prolonger l'accès ». Rendu serveur, sous le `PageIntro` de la page.                                                                     |
| Score : seuils et couleur          | `lib/score.ts`                                                                                          | `PASS_THRESHOLD`, `scoreTone`, `isPassing`, `SCORE_TONE_TEXT`, `scoreTextClass`, `scoreSoftClass` (score retenu compris). Aucun seuil 80/60 écrit ailleurs, SQL compris.                                                                                                                                    |
| Tonalité → couleur                 | `lib/tone.ts`                                                                                           | `TONE_TEXT`, `TONE_SOFT`, `TONE_COLOR` (variable CSS pour un SVG ou recharts). Aucune table de couleurs par tonalité ailleurs.                                                                                                                                                                              |
| Anneau de score                    | `ScoreRing` — `components/shared/score-ring.tsx`                                                        | Couleur tirée de `scoreTone`. Statique (pas d'animation d'entrée) ; `valueTestId` pour le pourcentage. `null` = aucun score lisible : anneau vide et « — », jamais 0 %.                                                                                                                                     |
| Carte de chiffre (espace étudiant) | `VitalCard` — `components/shared/vital-card.tsx`                                                        | Libellé mono, grand chiffre serif, unité, contexte, tendance en points (`trend`, annoncée au lecteur d'écran). Valeur déjà formatée : « — » sans donnée, l'unité disparaît. Rendu serveur (icône Lucide en prop). La bande admin est `StatBand`.                                                            |
| Graphique de score 0–100           | `ScoreChart` — `components/shared/charts/score-chart.tsx`                                               | Seul graphique de score : courbe et seuil `PASS_THRESHOLD`, état vide `EmptyState` (recharts non chargé sans point), figure résumée pour un lecteur d'écran. Jamais pour des montants.                                                                                                                      |
| Chargement différé d'un graphique  | `lazyChart` + `ChartSkeleton` — `components/shared/charts/lazy-chart.tsx`                               | `next/dynamic` en `ssr: false`, squelette à la hauteur du graphique. À appeler au niveau du module ; le contenu recharts vit dans son propre fichier.                                                                                                                                                       |
| Sommaire de sections               | `SectionNav` — `components/shared/section-nav.tsx`                                                      | Ancres : colonne collante dès 1024 px (`className` pour le `top-…`), bloc repliable en dessous. `numbered`, `active` si l'appelant suit le défilement. Documents légaux, profil.                                                                                                                            |
| Onglets segmentés (filtre)         | `SegmentedControl` — `components/ui/segmented-control.tsx`                                              | Choix exclusif sans panneau : boutons à `aria-pressed`, 40 px, 44 px sous 768 px, `testIdPrefix` ou `testId` par option, effectif `count` en mono. Période du tableau de bord, thème du profil, filtre de la correction. Des onglets à panneaux restent `Tabs`.                                             |
| Profil (étudiant et admin)         | `ProfilePage`, `ProfileView`, `ProfileSection` — `components/shared/profile/`                           | Page serveur commune (`profilePath` pour le réessai et le retour OAuth), sommaire, sections, squelette `ProfileSkeleton`.                                                                                                                                                                                   |
| Montants, dates, durées            | `lib/format.ts`, `lib/currency.ts`, `lib/attempt-clock.ts`                                              | `formatCurrency` (`whole` pour un total arrondi), `formatPercent` (`digits`, `signed`), dates ancrées sur l'heure de l'Est, `formatDuration`, `formatMinutesSeconds`, `centsToInputAmount`.                                                                                                                 |
| Champ de recherche                 | `SearchInput` — `components/shared/search-input.tsx`                                                    | Icône ou spinner (`isSearching`), `onValueChange`.                                                                                                                                                                                                                                                          |
| Valeur débouncée                   | `useDebouncedValue` — `hooks/use-debounced-value.ts`                                                    | `onSettle` pour remettre la pagination à zéro au même instant.                                                                                                                                                                                                                                              |
| Multi-sélection recherchable       | `MultiCombobox` — `components/shared/multi-combobox.tsx`                                                | Options filtrées par l'appelant (local ou serveur), quota, « Tout effacer ». Forme compacte (menu).                                                                                                                                                                                                         |
| Multi-sélection en liste à cocher  | `MultiChecklist` — `components/shared/multi-checklist.tsx`                                              | Même contrat que `MultiCombobox` (options filtrées par l'appelant, quota, « Tout effacer »), en liste ouverte avec recherche, pastilles au-dessus et complément par ligne (`renderMeta`) : pour des dizaines d'options à parcourir (objectifs du CMC). 44 px sous 1024 px.                                  |
| Pastille retirable                 | `FilterChip` — `components/shared/filter-chip.tsx`                                                      |                                                                                                                                                                                                                                                                                                             |
| Tableau de données, pagination     | `components/shared/data-table/`                                                                         | `DataTable`, `TablePagination` (`summary="page"` pour « Page 1 sur 4 » à la place du compteur d'éléments ; numéros à 44 px sous 1024 px).                                                                                                                                                                   |
| Redirection vers Stripe Checkout   | `useCheckout` — `hooks/use-checkout.ts`                                                                 | `pendingProduct` pour le spinner du bon bouton.                                                                                                                                                                                                                                                             |
| Avatar                             | `UserAvatar` — `components/shared/user-avatar.tsx`                                                      | Voir `data-layer.md`.                                                                                                                                                                                                                                                                                       |
| Lien sans prefetch                 | `LinkPendingIndicator` — `components/shared/link-pending-indicator.tsx`                                 | Voir `loading-ui.md`.                                                                                                                                                                                                                                                                                       |
| Coquilles authentifiées            | `StudentShell`, `AdminShell` — `components/shared/shell/`                                               | Cadre commun `ShellFrame` : SideNav dès 1024 px, Sheet en dessous (bascule en CSS). Liens et titre de page dans `lib/shell-navigation.ts`. Un en-tête collant de page se pose sous les barres par `top-(--shell-offset)`. Environnement de l'AdminBar lu par le layout.                                     |
| Logotype                           | `Logo` — `components/shared/logo.tsx`                                                                   | Marque claire et sombre choisies par la classe `.dark`. `tagline`, `admin`.                                                                                                                                                                                                                                 |
| Bascule de thème                   | `ThemeToggle` — `components/shared/theme-toggle.tsx`                                                    | Clair / Sombre / Système. Garde `useMounted` : hydratation.                                                                                                                                                                                                                                                 |
| En-tête de page de la vitrine      | `MarketingHero`, `Eyebrow` — `components/marketing/marketing-hero.tsx`                                  | Libellé, `h1`, paragraphe, trame de points. `size="display"` + `aside` pour un héros à deux colonnes, `band` pour une bande pleine largeur, `breadcrumb`. `MARKETING_WRAP` et `MARKETING_SECTION` fixent conteneur et sections.                                                                             |
| Chiffres publics                   | `MarketingFigures`, `publicFigures` — `components/marketing/marketing-figures.tsx`                      | `layout="row"` (bande de héros) ou `list`. Valeurs tirées des stats en cache et de `MARKETING_CLAIMS`, jamais écrites en dur.                                                                                                                                                                               |
| Bande d'appel à l'action           | `CtaBand` — `components/marketing/cta-band.tsx`                                                         | Section marine (`.dark` sur trame de points) en fin de page de contenu ; pas sur les pages d'état.                                                                                                                                                                                                          |
| Cellules numérotées                | `FeatureCells` — `components/marketing/feature-cells.tsx`                                               | « 01 Titre » + texte, séparés par des filets ; 3 ou 4 colonnes.                                                                                                                                                                                                                                             |
| FAQ en accordéon                   | `FaqSection`, `FaqAccordion` — `components/marketing/faq-section.tsx`                                   | Section deux colonnes avec lien vers `/faq`, première réponse ouverte.                                                                                                                                                                                                                                      |
| Preuve sociale, étoiles            | `ProofLine`, `Stars` — `components/marketing/proof-line.tsx`                                            | Avatars des témoignages, note `MARKETING_CLAIMS.rating`, nombre de candidats.                                                                                                                                                                                                                               |
| Question jouable sur la vitrine    | `DemoQuestion` — `components/marketing/demo-question.tsx`                                               | La vraie `QuestionCard` : `tutor` (correction, explication si la question la porte), `exam` (aucune correction), `sample` (clé seule). Questions figées dans `constants/sample-questions.ts`.                                                                                                               |
| Pastille de la vitrine             | `chipClass` — `components/marketing/chip.tsx`                                                           | 32 px, 44 px sous 768 px ; l'état actif se lit par `aria-pressed` ou `aria-current`.                                                                                                                                                                                                                        |
| Domaines publics                   | `DOMAINS`, `DOMAIN_GROUPS`, `domainBySlug` — `constants/domains.ts`                                     | Liste figée : slugs de `/domaines/[slug]`, groupes, objectifs du CMC. Aucun nombre de questions.                                                                                                                                                                                                            |
| Carte de prix                      | `PricingCard` — `components/shared/payments/pricing-card.tsx`                                           | Accès simple ou `variant="featured"` (Pack Premium) ; économies par `savingsOf`, prix d'appel par `cheapestMonthly`, durée par `monthsOf` (`lib/pricing.ts`), lus dans le catalogue. Redirection par `useCheckout`.                                                                                         |
| Carte d'état centrée               | `StatusCard`, `StatusScreen` (+ `StatusTitle`, client) — `components/shared/status-card.tsx`            | Porte le `h1` : pages d'état (404, 500, compte suspendu, désabonnement) et authentification (`size="form"`). `focusTitle` quand la carte remplace l'écran où l'on vient d'agir.                                                                                                                             |
| Document légal                     | `LegalDocument` — `components/shared/legal-document.tsx`                                                | Articles en données (paragraphe, liste, note, contact, petits caractères), sommaire latéral suivant le défilement.                                                                                                                                                                                          |
| Retour à la page précédente        | `BackButton` — `components/shared/back-button.tsx`                                                      | `history.back()` ; pages d'état (404).                                                                                                                                                                                                                                                                      |

`Progress` (`components/ui/progress.tsx`) prend une couleur d'indicateur
(`indicatorColor`, valeur de `TONE_COLOR`) : maîtrise par domaine, temps
d'accès restant.

Annoncés par la refonte, créés avec leur premier écran consommateur, jamais
seuls : `StatBand`, `ValueBarChart`, `ColumnChart` (chargés par `lazyChart`),
`FilterPanelButton` + `FilterGroup`, `ColumnsMenu`, `SortHeader`, `StepTitle`,
`SummaryPanel`.
