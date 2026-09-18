---
paths:
  - "app/**"
  - "components/**"
---

# États de chargement

Un indicateur par **type d'attente**. Cette table fait foi ; toute exception se
justifie dans le code.

| Type d'attente                                  | Indicateur                                                                                                                                            | Jamais             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Navigation** (le contenu n'existe pas encore) | Squelette à la forme du contenu (`loading.tsx` ou `<Suspense>`) ; sans prefetch, `<LinkPendingIndicator>` dans le lien cliqué en attendant la réponse | Overlay            |
| **Rechargement en place** (filtre, tri, page)   | `<PendingRegion isPending>` — contenu conservé, grisé                                                                                                 | Squelette, spinner |
| **Action utilisateur** (bouton, form, upload)   | `<Spinner size="sm">` DANS le déclencheur + `disabled`                                                                                                | Écran d'attente    |
| **Attente sur un tiers** (Stripe)               | Écran dédié plein cadre, texte explicite                                                                                                              | —                  |

## Invariants

- **Aucun `fixed inset-0` pour un chargement.** Un chargement ne bloque que sa
  propre zone. (Les `fixed inset-0` de `components/ui/{dialog,sheet,alert-dialog}.tsx`
  et l'overlay anti-triche de `components/quiz/pause-dialog.tsx` sont légitimes :
  ce ne sont pas des chargements.)
- **Un squelette n'est jamais un état terminal.** Absence de données = message
  explicite + recours (voir `_components/dashboard-error-state.tsx`).
- **Un seul spinner** : `components/ui/spinner.tsx`. Aucune animation faite main —
  verrouillé par `tests/architecture/loading-conventions.test.ts`.
- **Pas d'état de chargement pour la session — c'est un bug d'hydratation, pas
  seulement un défaut d'UX.** `authClient.useSession()` renvoie `isPending: true`
  au SSR (aucune session n'est résolue côté serveur) : le HTML serveur contenait
  donc l'overlay « Chargement… / Connexion en cours », que le client ne rendait
  pas une fois la session lue du cache cookie → **deux arbres DOM différents**.
  C'est une des causes prouvées de **NOMAQBANQ-5** (`replay_hydration_error` sur
  `/tableau-de-bord`, 25 utilisateurs), diagnostiquée sur la capture serveur/client
  de Sentry le 2026-07-29. Les layouts `(dashboard)`/`(admin)` gardent déjà la
  zone côté serveur et font descendre l'utilisateur en props via `toSessionUser`
  (`lib/session-user.ts`) : ne jamais réintroduire d'`authClient.useSession()`
  dans le shell.
  **Cause racine, établie sur le replay de NOMAQBANQ-1E (2026-08-12).** L'atome
  de session Better Auth n'est JAMAIS pré-rempli : il naît à
  `{ data: null, isPending: true }` et n'est peuplé que par `onMount` →
  `setTimeout(…, 0)` → aller-retour réseau. La session n'arrive donc pas AVANT
  l'hydratation — elle arrive **PENDANT**, quand l'hydratation dure assez
  longtemps (appareil d'entrée de gamme, gros bundle). Le store change entre
  deux frames et le sous-arbre que React s'apprête à hydrater ne rend plus le
  DOM servi.
  **Aucun composant rendu côté serveur ne doit brancher son balisage sur
  `authClient.useSession()`** — pas seulement le shell dashboard. Deux remèdes,
  selon que la page peut lire les cookies :
  - page déjà dynamique → descendre l'information en **prop depuis le Server
    Component** (`app/(marketing)/tarifs/page.tsx` passe `isAuthenticated`) ;
  - page ISR, où lire les cookies casserait la génération statique
    (`/`, `/domaines`, `/a-propos`, `/evaluation` sont en `revalidate = 3600`)
    → garder la session cliente mais la neutraliser pendant l'hydratation avec
    `useMounted()` (`hooks/use-mounted.ts`), comme `components/marketing-header`
    et `components/shared/theme-toggle.tsx`.

  Deux corollaires qui coûtent cher à réapprendre :
  - **le levier de reproduction est la DURÉE d'hydratation, pas l'état.** Une
    machine de développement ne reproduira jamais : il faut throttler le CPU/le
    réseau, ou un vrai appareil lent. Trois PR (#127, #130, #133) ont visé cette
    issue en corrigeant du formatage avant que le replay ne donne la réponse ;
  - **un test qui fige la session à une valeur constante ne teste rien** — il
    passe que la garde existe ou non. Il faut faire CHANGER la valeur entre
    `renderToString` et `hydrateRoot`, et observer `onRecoverableError`
    (`tests/components/MarketingHeader.test.tsx`).

  Corollaire général : **tout état dérivé du client seul (session, `window`,
  `Date.now()`) rendu conditionnellement pendant le SSR produit un mismatch.**
  L'autre cause de la même issue était le salut du hero calculé sur l'heure du
  runtime (corrigé par #130, `getAppZoneHour`).

- **Une valeur d'horloge se rend depuis une ancre serveur, pas depuis
  `Date.now()`.** Le premier rendu s'exécute DEUX fois — SSR puis hydratation —
  à deux instants ; tout ce qui s'affiche à la seconde (ou bascule à minuit)
  diverge alors mécaniquement, d'autant plus que la page est lente à hydrater.
  Le Server Component descend l'instant du rendu en prop (`initialNow`, via un
  helper d'horloge au scope module pour `react-hooks/purity`) ; le premier rendu
  s'ancre dessus et seul le premier tick, post-hydratation, reprend l'horloge
  locale. Câblé ainsi dans `dashboard-hero`, `examen-blanc-client`,
  `admin-dashboard-client`, `useExamTimer` et `PauseDialog` (rendu au premier
  rendu quand la page se charge en pause). **Ce qui déclenche quelque chose
  (auto-soumission, reprise de pause) ne reprend JAMAIS `Date.now()`, même
  après le montage** : `useExamTimer` et `PauseDialog` mesurent l'écoulé par
  delta monotone depuis l'ancre (`hooks/use-anchored-clock.ts`,
  `performance.now()`). Une horloge cliente en avance du budget auto-soumettait
  l'examen au premier tick, sans recours (#196) ; la latence de livraison
  entre le rendu serveur et le montage n'est pas rattrapée, c'est la grâce
  serveur qui l'absorbe. Limite de l'horloge monotone : elle ne court pas
  pendant la veille du système (iOS/macOS/Linux), et un retour arrière remonte
  le runner sur le `initialNow` périmé du payload RSC réutilisé. D'où le
  ré-ancrage : `saveExamAnswer`, `pauseExam` et `resumeExam` renvoient
  `serverNow`, que `useQuizSession` repasse en ancre au chrono (adoptée
  au-delà de 2 s d'écart, pour ne pas faire sauter le décompte au RTT). Au
  réveil de l'onglet (`visibilitychange`/`focus`), un écart de plus de 5 s
  entre l'horloge murale et la monotone trahit une veille : le runner demande
  l'heure au serveur (`readServerClock`) et ré-ancre — jamais sur
  `Date.now()` seul, qui reproduirait le bug. Sur refus `TIME_UP` d'une
  réponse, le moteur soumet l'examen au lieu de faire réessayer. `useClock` (phases
  d'examen, tick à la minute) reste sur `Date.now()` : pur affichage, rien à
  déclencher. Le chrono d'examen était la
  dernière exception : cause prouvée de **NOMAQBANQ-13** (replay du 2026-08-23,
  « 02:06:51 » servi contre « 02:06:50 » hydraté) — l'arbre de la page de
  passation était régénéré en plein examen. L'arithmétique elle-même vit dans
  `lib/attempt-clock.ts`, dont chaque fonction prend `now` en paramètre : un
  défaut sur `Date.now()` est exactement le piège.

## Socle

`components/ui/spinner.tsx` · `components/ui/skeleton.tsx` ·
`components/ui/skeleton-patterns.tsx` (`SkeletonText`, `SkeletonCard`,
`SkeletonStatRow`, `SkeletonTable`, `PageSkeleton`) ·
`components/ui/pending-region.tsx` · `components/admin/admin-list-skeleton.tsx`.

## `loading.tsx` — pas d'héritage implicite

Next fait remonter le `loading.tsx` du parent sur un segment enfant qui n'a pas
le sien. **L'invariant : aucune route ne doit hériter d'un squelette d'une AUTRE
forme que la sienne** — le squelette du tableau de bord en ouvrant `bienvenue`,
celui d'une liste admin en ouvrant un formulaire de création.

Concrètement : toute route dont le parent porte un squelette **dédié**
(`tableau-de-bord`, `profil`, `entrainement`, `admin`, les 4 listes admin)
déclare le sien. Hériter du `PageSkeleton` générique d'un parent direct est en
revanche correct — c'est exactement ce qu'on écrirait.

**À l'ajout d'une route authentifiée, vérifier de quel `loading.tsx` elle
hérite** avant de conclure qu'elle n'en a pas besoin.

## Le garde d'onboarding lit la session du layout, sans la refetcher

`OnboardingGuard` (`components/shared/onboarding-guard.tsx`) reste un composant
client monté par `app/(dashboard)/layout.tsx`, parce qu'un layout n'a pas accès
à `pathname` (`node_modules/next/dist/docs/.../layout.md:240`). Mais il ne lit
PAS la session côté client : le layout la résout déjà et lui passe
`hasUsername`. Un `useSession()` de plus = un `GET /api/auth/get-session`
(invocation Vercel + Neon) sur chaque page du dashboard. Même règle pour
`NavSecondary` (`isUserAdmin` vient de `DashboardShell`).

Conséquence : la prop vient d'un layout qui **ne se re-rend pas à la navigation
client**. La fin d'onboarding (`onboarding-form.tsx`) ne fait QUE
`router.refresh()` — jamais un `router.replace()` derrière : une navigation
dispatchée pendant un refresh en vol écarte ce refresh
(`next/dist/client/components/app-router-instance.js`, « discarded »), la prop
resterait fausse et le guard ferait ping-pong `/tableau-de-bord` ↔ `/bienvenue`.
Le refresh rejoue lui-même le `redirect()` serveur de `bienvenue/page.tsx` avec
un arbre frais ; à défaut, le guard navigue sur prop fraîche.

## Liens à fort volume vers une route authentifiée : `prefetch={false}` + indicateur

Toutes les routes sous `/tableau-de-bord` et `/admin` sont dynamiques : le
prefetch par défaut d'un `<Link>` rend le layout côté serveur (→
`requireSession` → Neon) pour chaque lien entré dans le viewport, et le rejoue
à l'expiration du cache — une invocation Vercel par lien visible. Les liens
présents sur chaque page ou en liste — sidebar (`nav-main`, `nav-secondary`) et
accueil du dashboard (`quick-access-grid`, `next-actions-panel`,
`recent-activity-feed`, un lien par activité) — sont donc en `prefetch={false}`.

Le prix, à ne pas oublier : **sans prefetch, le squelette `loading.tsx` de la
cible n'arrive qu'avec la réponse du serveur** (`loading.md` : « The Fallback UI
is prefetched, making navigation immediate »). Le clic resterait sans retour
visuel le temps du layout, réveil Neon compris. D'où `<LinkPendingIndicator />`
(`components/shared/link-pending-indicator.tsx`, `useLinkStatus`) rendu DANS
chaque lien concerné : le `Spinner` du socle, différé de 150 ms pour ne pas
clignoter sur une navigation rapide. C'est l'exception assumée à « jamais de
spinner pour une navigation ».

Les liens de détail (panneaux admin, pages de résultats, paiement, profil)
gardent le prefetch par défaut : volume négligeable, à mesurer après
déploiement avant toute extension. Un nouveau lien suit la règle de sa surface.

## Couverture

Les squelettes sont du balisage sans logique : les ajouter à `coverage.exclude`
de `vitest.config.ts` (comme `components/admin/admin-list-skeleton.tsx`) plutôt
que d'écrire des tests vides. `components/ui/**` est déjà exclu.
