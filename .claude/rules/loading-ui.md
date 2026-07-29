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
  Corollaire général : **tout état dérivé du client seul (session, `window`,
  `Date.now()`) rendu conditionnellement pendant le SSR produit un mismatch.**
  L'autre cause de la même issue était le salut du hero calculé sur l'heure du
  runtime (corrigé par #130, `getAppZoneHour`).

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
