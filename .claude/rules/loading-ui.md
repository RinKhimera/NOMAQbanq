---
paths:
  - "app/**"
  - "components/**"
---

# États de chargement

Un indicateur par **type d'attente**. Cette table fait foi ; toute exception se
justifie dans le code.

| Type d'attente                                  | Indicateur                                                      | Jamais             |
| ----------------------------------------------- | --------------------------------------------------------------- | ------------------ |
| **Navigation** (le contenu n'existe pas encore) | Squelette à la forme du contenu (`loading.tsx` ou `<Suspense>`) | Spinner, overlay   |
| **Rechargement en place** (filtre, tri, page)   | `<PendingRegion isPending>` — contenu conservé, grisé           | Squelette, spinner |
| **Action utilisateur** (bouton, form, upload)   | `<Spinner size="sm">` DANS le déclencheur + `disabled`          | Écran d'attente    |
| **Attente sur un tiers** (Stripe)               | Écran dédié plein cadre, texte explicite                        | —                  |

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
  `admin-dashboard-client` et `useExamTimer`. Le chrono d'examen était la
  dernière exception : cause prouvée de **NOMAQBANQ-13** (replay du 2026-08-23,
  « 02:06:51 » servi contre « 02:06:50 » hydraté) — l'arbre de la page de
  passation était régénéré en plein examen.

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

## Le garde d'onboarding ne peut pas vivre dans un layout

`OnboardingGuard` (`components/shared/onboarding-guard.tsx`) reste un composant
client monté par `app/(dashboard)/layout.tsx`. Ne pas « simplifier » sa logique
en la remontant dans le layout : un layout ne se re-rend pas à la navigation et
n'a donc pas accès à `pathname`
(`node_modules/next/dist/docs/.../layout.md:240`) — un utilisateur sans
`username` quittant `/bienvenue` par la sidebar ne serait jamais ramené.

## Couverture

Les squelettes sont du balisage sans logique : les ajouter à `coverage.exclude`
de `vitest.config.ts` (comme `components/admin/admin-list-skeleton.tsx`) plutôt
que d'écrire des tests vides. `components/ui/**` est déjà exclu.
