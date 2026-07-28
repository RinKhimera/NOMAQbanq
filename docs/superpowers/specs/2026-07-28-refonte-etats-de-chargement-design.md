# Spec — Refonte des états de chargement (loading UI)

- **Date** : 2026-07-28
- **Statut** : DESIGN VALIDÉ — revue adversariale passée le 2026-07-28, constats
  🔴1 🔴2 🟠3 🟠4 intégrés (voir _Constats de revue intégrés_)
- **Origine** : constat utilisateur « il y a des overlays de loading, par moments
  on utilise des squelettes, d'autres fois des composants qui remplissent tout
  l'écran », suivi d'un audit du code de chargement sur l'ensemble de l'app.

## Problème

Six mécanismes de chargement cohabitent sans règle commune, hérités de couches
successives (ère client-auth Convex → Server Components → Server Actions).

### 1. Un overlay plein écran bloquant, sur chaque page authentifiée

`components/shared/generic-nav-user.tsx:57` — un composant **de sidebar** rend un
`fixed inset-0 z-50 backdrop-blur-sm` qui masque toute l'application pendant que
`authClient.useSession()` résout côté client (« Chargement… / Connexion en
cours »). Il se déclenche sur **chaque** route `(dashboard)` **et** `(admin)`.

Il est redondant : `app/(dashboard)/layout.tsx:11` appelle déjà
`requireSession()` et `app/(admin)/layout.tsx:11` `requireRole(["admin"])`,
**avant le moindre rendu**. Le garde client n'apporte aucune sécurité — il
n'apporte qu'un flash plein écran. Une seconde variante du même overlay
(`generic-nav-user.tsx:86`, « Accès refusé ») est structurellement inatteignable
en pratique, le layout serveur ayant déjà redirigé.

En revanche `components/shared/onboarding-guard.tsx` **ne rend aucune UI**
(`return null`, ligne 28) : il ne produit aucun artefact de chargement et sort du
périmètre — voir _Constats de revue intégrés_, 🔴1.

### 2. Sept `loading.tsx` incohérents

Deux vrais squelettes (`tableau-de-bord`, `admin`) ; **cinq copies conformes du
même spinner centré `min-h-[50vh]`** (`entrainement`, `examen-blanc`, `profil`,
`abonnements`, `(marketing)/evaluation`).

### 3. Des squelettes écrits puis jamais montés

`ProfileSkeleton`
(`app/(dashboard)/tableau-de-bord/profil/_components/profile-skeleton.tsx`) et
`UserTableSkeleton`
(`app/(admin)/admin/utilisateurs/_components/user-table-skeleton.tsx`) ne sont
importés nulle part. La page profil **a** un squelette soigné et affiche un
spinner.

### 4. Un squelette utilisé comme état terminal

`app/(dashboard)/tableau-de-bord/page.tsx:46` :
`if (!stats) return <DashboardSkeleton />`. Si `stats` est absent, l'utilisateur
regarde un squelette qui pulse **indéfiniment**, sans message ni recours.

### 5. Le contenu disparaît à chaque rechargement en place

Table admin utilisateurs (`users-table.tsx:123`), navigateur de questions,
historique d'entraînement (`training-history-section.tsx:139`) : à chaque
changement de filtre, de tri, de page ou frappe dans la recherche debouncée, le
contenu est **remplacé** par un spinner centré → saut de layout et clignotement.

### 6. Quatre implémentations de spinner

- `LoaderCircle` (lucide) — majoritaire ;
- `Loader2` (même icône, autre alias) — `evaluation-client.tsx` ;
- `<div className="animate-spin rounded-full border-b-2 border-blue-600">` fait
  main — `generic-nav-user` (×2), `(marketing)/evaluation/quiz/page.tsx` (×2),
  `bienvenue/page.tsx`, `pause-dialog` (variante `border-white`) ;
- `<span className="... border-2 border-gray-300 border-t-gray-600">` —
  `abonnements-client.tsx`.

Tailles `h-4` / `h-5` / `h-6` / `h-8` / `h-12`, coloris `text-gray-400` /
`text-muted-foreground` / `text-blue-600` / `border-orange-500`. Conteneurs
`min-h-[50vh]`, `h-[60vh]`, `min-h-96`, `min-h-screen`, `py-12`, `p-8`. Aucun
composant `Spinner` partagé n'existe.

### 7. Aucun streaming

Les pages font `await Promise.all([...])` (7 requêtes DAL sur le tableau de bord
étudiant, 5 sur `admin/utilisateurs`) : rien ne s'affiche avant la plus lente,
puis tout apparaît d'un coup. Les 4 `<Suspense>` du projet sont des
`fallback={null}` servant uniquement à borner `useSearchParams`.

## Décision d'architecture préalable : pas de Cache Components / PPR

Évalué et **écarté pour ce chantier** (doc Next 16 embarquée dans
`node_modules/next/dist/docs/`) :

- **Les données sont privées par utilisateur.** `use cache` ne peut pas cacher
  des lectures dépendant de la session. Il faudrait `'use cache: private'`,
  marqué `version: experimental`, dépendant du _runtime prefetching_ « pas encore
  stable », et **jamais stocké côté serveur** (cache mémoire navigateur, perdu au
  reload) — `01-app/03-api-reference/01-directives/use-cache-private.md:15-28`.
- **Les layouts sont dynamiques par construction.** `await requireSession()` /
  `requireRole()` en tête de layout = accès runtime hors `<Suspense>` → insight
  `blocking-route`. La doc prévoit ce cas et propose `unstable_instant = false`
  sur le layout dashboard (`01-app/02-guides/instant-navigation.md:275-281`) : le
  bénéfice principal serait neutralisé là où on en aurait besoin.
- **Risque de régression `<Activity>`.** Avec `cacheComponents`, Next ne démonte
  plus les routes en navigation et **préserve le `useState`**
  (`.../cacheComponents.md:36-50`) : dropdowns restant ouverts, formulaires non
  réinitialisés, effets de dialog qui ne re-tirent pas. Sur une app avec moteur de
  quiz et examen chronométré, c'est un audit complet pour un gain nul sur le
  problème traité ici.

**Dette identifiée** (hors périmètre) : évaluer `cacheComponents` sur le seul
groupe `(marketing)`, statique et public. Ces pages ne posent aucun problème de
chargement aujourd'hui.

## Doctrine — un indicateur par type d'attente

C'est la règle absente qui a produit le désordre. Elle devient la référence du
projet (`.claude/rules/loading-ui.md`).

| Type d'attente                                                 | Indicateur                                                         | Jamais             |
| -------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------ |
| **Navigation** vers une route (le contenu n'existe pas encore) | Squelette à la forme du contenu, via `loading.tsx` ou `<Suspense>` | Spinner, overlay   |
| **Rechargement en place** (filtre, tri, pagination, recherche) | Contenu conservé, grisé, `aria-busy`                               | Squelette, spinner |
| **Action utilisateur** (bouton, formulaire, upload)            | `<Spinner>` **dans** le déclencheur + `disabled`                   | Écran d'attente    |
| **Attente sur un tiers** (Stripe confirmant un paiement)       | Écran dédié plein cadre, texte explicite                           | —                  |

**Invariant** : aucun composant ne rend jamais un `fixed inset-0` pour un état de
chargement. Un chargement ne bloque que sa propre zone.

**Corollaire** : un squelette n'est jamais un état terminal. Absence de données =
message + recours.

## Architecture

### Socle — `components/ui/`

**`spinner.tsx` (nouveau)** — le seul spinner de l'app.

- `LoaderCircle` de `lucide-react`, trois tailles : `sm` 16px, `md` 20px (défaut),
  `lg` 32px ;
- couleur héritée via `currentColor` — correct par construction sur un bouton
  primaire, dans un input, sur fond sombre, sans variante de couleur à choisir ;
- `role="status"` + `<span className="sr-only">Chargement…</span>` intégrés ;
- classe `motion-reduce:animate-none` (Tailwind v4).

Il remplace les 4 implémentations et l'ensemble des usages ad hoc.

**`skeleton.tsx` (existant, inchangé)** — primitive `animate-pulse`, complétée de
`motion-reduce:animate-none`.

**`skeleton-patterns.tsx` (nouveau)** — les structures qui se répètent :

- `SkeletonText({ lines })` — n lignes de largeur décroissante ;
- `SkeletonCard` — carte avec en-tête + corps ;
- `SkeletonStatRow({ count })` — la rangée de KPI présente sur 5 écrans ;
- `SkeletonTable({ columns, rows })` — en-tête réel, hauteur figée. Absorbe la
  `TableSkeleton` locale de `components/shared/payments/transaction-table.tsx:220`
  (cinquième implémentation, non recensée à l'audit initial) ;
- `PageSkeleton` — forme générique « page authentifiée » (titre, rangée de cartes,
  bloc de contenu). C'est le repli **explicite** des routes sans squelette dédié :
  il est monté par un `loading.tsx` nommément, jamais hérité par accident.

**`pending-region.tsx` (nouveau)** — enveloppe une zone ; quand `isPending`,
applique `opacity-60 pointer-events-none transition-opacity` + `aria-busy="true"`.

Les mises en page propres à un écran restent **co-localisées** en
`_components/*-skeleton.tsx`, composées de ces primitives. On ne crée pas de
répertoire central `components/skeletons/` : c'est ce qui a produit le
`ProfileSkeleton` mort (loin de la page, jamais mis à jour).

Aucune nouvelle dépendance. Pas de barre de progression globale.

### Suppression de l'overlay bloquant

`GenericNavUser` redevient un simple item de menu :

- suppression de l'overlay `fixed inset-0` (les deux occurrences), du `useEffect`
  de redirection et de la branche « Accès refusé » ;
- il ne consomme plus `useCurrentUser` : le layout serveur **lui passe
  l'utilisateur en prop** (il détient déjà la session). Il n'a donc plus d'état de
  chargement du tout — l'avatar est présent dès le premier octet de HTML.
- `DashboardShell` (client) relaie la prop ; il ne fabrique plus `GenericNavUser`
  lui-même à partir du seul `variant`.

**`OnboardingGuard` n'est PAS touché** — voir 🔴1. Il reste en place, avec ses
six tests.

En revanche `app/(dashboard)/tableau-de-bord/bienvenue/page.tsx` **est** dans le
périmètre : c'est un état de chargement (spinner `min-h-96`, ligne 84) né d'un
`useCurrentUser` inutile. La page devient un Server Component qui lit la session
et passe les valeurs initiales (`name`, `bio`) au formulaire, resté client. Elle
perd son spinner et sa branche « Impossible de charger les informations du
profil ». `OnboardingGuard`, monté dans le layout, continue de faire son travail
indépendamment.

**PII / frontière serveur-client** : on ne passe pas la session Better Auth
entière en prop (elle porte `session.token`), conformément à
`.claude/rules/data-layer.md`. On extrait uniquement `{ id, name, email, image,
role, username }`.

`tests/components/OnboardingGuard.test.tsx` est **conservé intégralement**.

### Couverture des routes

**Règle : un `loading.tsx` par segment, jamais d'héritage implicite.**

Next fait bien remonter le `loading.tsx` du parent sur un segment enfant qui n'a
pas le sien — mais s'appuyer là-dessus produit un squelette **de la mauvaise
forme** (le squelette du tableau de bord affiché en naviguant vers `abonnements`,
le squelette de liste admin affiché en ouvrant un formulaire de création). C'est
la contradiction 🟠4 et la fuite `AdminListSkeleton` relevées en revue.

Chaque segment feuille déclare donc explicitement le sien. `PageSkeleton` est le
défaut ; un squelette dédié quand la forme le justifie.

**Zone étudiant :**

| `loading.tsx`                               | Squelette monté                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `tableau-de-bord/`                          | `DashboardSkeleton` existant, réaligné                                                                            |
| `tableau-de-bord/profil/`                   | `ProfileSkeleton` existant, **remis en service**                                                                  |
| `tableau-de-bord/entrainement/`             | dédié (formulaire de config + historique)                                                                         |
| `tableau-de-bord/examen-blanc/`             | `PageSkeleton`                                                                                                    |
| `tableau-de-bord/examen-blanc/[examId]/`    | `PageSkeleton`                                                                                                    |
| `tableau-de-bord/abonnements/`              | `PageSkeleton`                                                                                                    |
| `tableau-de-bord/entrainement/[sessionId]/` | `PageSkeleton`                                                                                                    |
| `(marketing)/evaluation/`                   | dédié (squelette de `QuestionCard`) — le groupe `(marketing)` n'a aucun repli, les autres pages y étant statiques |

`tableau-de-bord/paiement/succes` n'en reçoit pas : c'est une attente sur un
tiers (Stripe), donc un écran dédié assumé (ligne 4 de la doctrine).

**Zone admin — `AdminListSkeleton`** (`components/admin/admin-list-skeleton.tsx`) :
`utilisateurs`, `questions`, `examens` et `transactions` partagent la même
anatomie (stat cards → barre de filtres → table paginée). Un composant paramétré
(`statCount`, `columns`), monté par le `loading.tsx` de ces quatre routes **et
d'elles seules**.

| `loading.tsx`                                                                 | Squelette monté                             |
| ----------------------------------------------------------------------------- | ------------------------------------------- |
| `admin/`                                                                      | `AdminDashboardSkeleton` existant, réaligné |
| `admin/{utilisateurs,questions,examens,transactions}/`                        | `AdminListSkeleton`                         |
| `admin/utilisateurs/[id]/`                                                    | `PageSkeleton`                              |
| `admin/questions/nouvelle/`, `admin/questions/[questionId]/modifier/`         | `PageSkeleton`                              |
| `admin/examens/creer/`, `admin/examens/modifier/[id]/`, `admin/examens/[id]/` | `PageSkeleton`                              |
| `admin/examens/[id]/resultats/[userId]/`                                      | `PageSkeleton`                              |
| `admin/profil/`                                                               | `PageSkeleton`                              |

Les cinq `loading.tsx` à spinner disparaissent : deux montent désormais un
squelette dédié (`profil`, `entrainement`), deux montent `PageSkeleton`
(`examen-blanc`, `abonnements`), un devient un squelette de question
(`(marketing)/evaluation`).

### Streaming interne — deux pages seulement

Sur `app/(dashboard)/tableau-de-bord/page.tsx` et `app/(admin)/admin/page.tsx`
uniquement. Les KPI (agrégats rapides) s'affichent avant les graphiques
(historiques de scores, revenus par jour).

**Mécanisme retenu, arrêté à l'écriture du plan.** L'intention initiale — éclater
la page en composants serveur `<StatsSection>` / `<ChartsSection>` — s'est révélée
irréalisable telle quelle : `DashboardClient` (10 props) et
`AdminDashboardClient` (8 props) reçoivent **toutes** leurs données en props, et
les découper reviendrait à réécrire les deux écrans les plus vus de l'app. On ne
les découpe donc pas : on sort du `Promise.all` les seules requêtes lentes (les
séries qui alimentent les graphiques), on passe la **promesse** non attendue, et
le composant de graphique la déballe avec `use()` de React 19 derrière son propre
`<Suspense>`. Deux props changent de type par page ; aucune structure ne bouge.

Le `loading.tsx` de la route reste : il couvre la navigation ; les `<Suspense>`
internes couvrent l'apparition progressive une fois le shell rendu.

Aucune autre page n'adopte le streaming interne (YAGNI — à réévaluer sur mesure,
pas par principe). **Cette partie est détachable** : elle constitue la dernière
phase du plan et peut être coupée sans rien abîmer, les squelettes de navigation
apportant déjà l'essentiel du gain perçu.

### Rechargement en place

`<PendingRegion isPending>` alimenté par le `useTransition` **déjà présent** dans
les managers. La revue a établi que le spec surestimait le nombre d'adoptants
(🔴2, 🟠3) : il y en a **deux**, tous deux vérifiés.

| Adoptant                                                                     | État actuel                                                                                | Après                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `users-table.tsx:123` (via `users-manager.tsx:79` → `isLoading={isPending}`) | la table est remplacée par un spinner centré à chaque filtre/tri/page                      | contenu conservé, grisé, `aria-busy`                              |
| `transaction-table.tsx:220` (via `transactions-manager.tsx:86,228`)          | squelette **seulement** si la liste est vide ; aucun retour visuel quand elle ne l'est pas | squelette si vide (correct, conservé) ; sinon grisé + `aria-busy` |

Non-adoptants, corrigés autrement :

- **`training-history-section.tsx`** — `isLoading` y vaut `false` en dur (ligne 68) : le spinner de la ligne 139 est **du code mort**, et la section n'a ni
  filtre ni tri (liste keyset « voir plus », dont l'attente est déjà rendue dans
  le bouton via `isLoadingMore` — exactement la ligne 3 de la doctrine). On
  supprime la variable morte et sa branche ; rien d'autre.
- **Navigateur de questions** — il rend déjà un squelette, et seulement au
  premier chargement (`isLoading = !hasLoaded`) : conforme à la doctrine. Son
  `useTransition` jette `isPending` (`question-browser-context.tsx:80`), donc il
  n'y a pas de signal à brancher. Seul changement : son squelette est replié sur
  `SkeletonTable`. Exposer `isPending` pour griser au refetch est noté comme
  amélioration possible, **hors périmètre**.

Conservé : le `<Spinner size="sm">` **dans le champ de recherche**
(`users-filter-bar.tsx:96`, `question-browser-toolbar.tsx:42`) — bon pattern, il
change seulement de composant.

`UserTableSkeleton` (code mort) est supprimé : `users-table` n'est plus jamais
remplacée par un squelette après le premier rendu.

### États dégradés et zones sensibles

- `tableau-de-bord/page.tsx:46` — le squelette-comme-état-terminal devient un
  message explicite (« Impossible de charger vos statistiques ») avec bouton
  « Réessayer ».
- **Quiz & passation d'examen** — habillage **uniquement**. Aucune modification
  de la logique de chronomètre, du budget-temps anti-triche, de la sérialisation
  des envois de réponses ni des invariants d'accès décrits dans
  `.claude/rules/data-layer.md`. `pause-dialog`, `finish-dialog`,
  `evaluation-client` passent au `<Spinner>` commun ; l'écran d'attente
  `min-h-screen` de `evaluation-client.tsx:346` devient un squelette de la carte
  d'examen.
- **Évaluation gratuite (marketing)** — « Chargement des questions… »
  (`(marketing)/evaluation/quiz/page.tsx:181`) devient un squelette de
  `QuestionCard` ; « Calcul du score… » (ligne 224) reste un **écran dédié**
  (transition attendue après un clic explicite) avec `<Spinner size="lg">`.
- **Boutons et formulaires** (~20 emplacements : `finish-dialog`, `exam-form`,
  `question-form-page`, `inline-edit-field`, `avatar-uploader`,
  `delete-*-dialog`, `export-questions-button`, `training-config-form`,
  `training-paywall`, `abonnements-client`, `resume-session-card`,
  `edit-transaction-modal`, `manual-payment-modal`…) : substitution mécanique par
  `<Spinner size="sm">`, sans changement de comportement.

### Accessibilité

`role="status"` + libellé lecteur d'écran sur le `Spinner` ; `aria-busy` sur les
zones en rechargement ; `motion-reduce:animate-none` sur le spinner et le
squelette.

## Garde-fous contre la récidive

1. **`.claude/rules/loading-ui.md`** — la doctrine (tableau ci-dessus) + le
   catalogue du socle, scopé `app/**` / `components/**`, référencé depuis la
   table _Instruction Routing_ d'`AGENTS.md`.
2. **Test d'architecture** — `tests/architecture/loading-conventions.test.ts` :
   échoue si `animate-spin` apparaît dans `app/**` ou `components/**` ailleurs
   que dans `components/ui/spinner.tsx`. ESLint ne sait pas lire les chaînes de
   `className` ; un test qui parcourt les sources est ici le garde-fou au meilleur
   rapport coût/efficacité.

   **La règle `fixed inset-0` initialement prévue est abandonnée.** La revue a
   montré qu'elle produirait des faux positifs sur des usages parfaitement
   légitimes : l'overlay **anti-triche** de `components/quiz/pause-dialog.tsx:90`
   (protégé par `PauseDialog.test.tsx:43` et par `.claude/rules/e2e-testing.md`),
   le fond du tiroir mobile de `question-navigator.tsx:255`, et les overlays
   `Dialog`/`Sheet`/`AlertDialog` de shadcn. Distinguer « overlay de chargement »
   d'« overlay légitime » par grep n'est pas fiable — un test qui pourrit la CI ne
   protège rien. C'est le test e2e ci-dessous qui couvre ce risque, par le
   comportement plutôt que par le texte.

3. **Test e2e** — au chargement du tableau de bord, sidebar et titre visibles
   immédiatement, sans overlay bloquant : c'est la non-régression de l'overlay
   `GenericNavUser`, et le garde-fou de substitution pour la règle abandonnée.

**Tests unitaires** : `Spinner`, `PendingRegion` et les patterns de squelette sont
couverts (seuil coverage 75 %, CI à 80 % — `.github/workflows/ci.yml`). Les
squelettes de page ne sont pas testés unitairement : balisage sans logique, déjà
couvert par le test d'architecture et l'e2e.

## Constats de revue intégrés

Revue adversariale du design, 2026-07-28. Verdict initial : NON, 4 points à
trancher. Tous tranchés ci-dessous, les deux 🔴 vérifiés indépendamment.

**🔴1 — La redirection onboarding ne peut pas vivre dans un layout.** Doc Next
embarquée, `layout.md:240` : « Layouts do not re-render on navigation, so they do
not access pathname ». Double blocage : la donnée du branchement (`pathname`)
n'est pas disponible, et le layout partagé n'étant pas ré-exécuté en navigation
client, un utilisateur sans `username` qui quitte `/bienvenue` par la sidebar n'y
serait jamais ramené. `OnboardingGuard` fait précisément ce que le layout ne peut
pas faire, avec `pathname` en dépendance d'effet.
**Décision : `OnboardingGuard` et ses six tests sont conservés à l'identique.** Il
rend `return null` (ligne 28) et ne produit donc aucun artefact de chargement :
il n'a jamais eu sa place dans ce spec. Seule la page `bienvenue` — qui, elle,
affiche un vrai spinner — reste dans le périmètre.

**🔴2 — `training-history-section` n'a pas d'attente à couvrir.** `isLoading` y
vaut `false` en dur (ligne 68, vérifié) : le spinner de la ligne 139 est du code
mort, et la section n'a ni filtre ni tri. **Décision : retiré des adoptants de
`PendingRegion` ; on supprime la branche morte, rien de plus.**

**🟠3 — Le navigateur de questions non plus.** Il rend un squelette, et seulement
au premier chargement ; son `useTransition` jette `isPending`
(`question-browser-context.tsx:80`, vérifié). **Décision : retiré des adoptants ;
seul son squelette est replié sur `SkeletonTable`.** Il reste deux adoptants
réels, `users-table` et `transaction-table`.

**🟠4 — Contradiction sur `tableau-de-bord/loading.tsx`**, décrit à la fois comme
repli générique et comme `DashboardSkeleton`. Un fichier ne monte qu'un
composant. **Décision : plus aucun héritage implicite** — chaque segment feuille
déclare son `loading.tsx`, `PageSkeleton` par défaut. Cela règle du même coup la
fuite d'`AdminListSkeleton` sur les routes enfants de l'admin, signalée comme
point de vigilance.

**Point de vigilance sur le test d'architecture** : traité dans _Garde-fous_, la
règle `fixed inset-0` est abandonnée au profit du test e2e.

**Correctif hors revue** : `transaction-table.tsx:220` porte une `TableSkeleton`
locale — cinquième implémentation de squelette de table, absente de l'audit
initial, repliée sur `SkeletonTable`.

## Hors périmètre

- `cacheComponents` / PPR (dette identifiée ci-dessus) ;
- `OnboardingGuard` et sa logique de redirection (🔴1) ;
- exposer `isPending` dans le navigateur de questions pour griser au refetch ;
- toute optimisation de requête DAL ;
- toute refonte visuelle autre que les états de chargement ;
- la logique métier du quiz et de la passation d'examen.

## Risques

| Risque                                                                                  | Mitigation                                                                                                 |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Un squelette dérive de la mise en page qu'il imite                                      | Co-localisation `_components/` + primitives mutualisées pour les formes répétées                           |
| Substitution de spinner massive (~30 fichiers) introduisant une régression visuelle     | Changement mécanique, sans logique ; revue diff par zone                                                   |
| `DashboardShell` recevant l'utilisateur en prop élargit la surface client               | Projection explicite d'un sous-ensemble de champs, jamais la session brute (`.claude/rules/data-layer.md`) |
| `bienvenue` convertie en Server Component change l'ordre d'initialisation du formulaire | Le formulaire reste client ; `OnboardingGuard` inchangé continue d'assurer la redirection                  |
| Un segment feuille oublié n'a pas de `loading.tsx` et hérite d'un squelette mal formé   | Énumération exhaustive des segments dans _Couverture des routes_ ; à recontrôler à l'ajout de toute route  |
