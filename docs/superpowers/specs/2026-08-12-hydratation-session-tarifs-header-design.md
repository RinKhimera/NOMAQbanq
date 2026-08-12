# Spec — Hydratation : supprimer le branchement de rendu sur la session cliente

- **Date** : 2026-08-12
- **Statut** : DESIGN VALIDÉ (en attente de revue adversariale)
- **Origine** : triage des issues Sentry ouvertes du 2026-08-12. Trois issues
  ouvertes ; deux nouvelles apparues les 2026-08-10 et 2026-08-11.

## Ce que disent les données Sentry

### Les trois issues ouvertes

| Issue           | Titre                                       | Page                                          | Volume                       | Dernier vu                       |
| --------------- | ------------------------------------------- | --------------------------------------------- | ---------------------------- | -------------------------------- |
| `NOMAQBANQ-5`   | `Hydration Error` (type `replay_hydration_error`) | `/tarifs`                                | 115 evts / 21 users depuis 2025-11-26 | 2026-08-11 01:08:49**.746** |
| `NOMAQBANQ-1E`  | `Hydration failed because the server rendered HTML didn't match the client` | `/tarifs` | 1 evt / 1 user | 2026-08-11 01:08:49**.739** |
| `NOMAQBANQ-1D`  | `Unknown unit of work tag (9227)`           | `/tableau-de-bord/examen-blanc/:examId/resultats` | 1 evt / 1 user          | 2026-08-10 19:03:57              |

**`-1E` et `-5` sont le même incident**, pas deux : même `replayId`
(`fae19f5bd6594aa6af37e243808e861a`), même milliseconde. Deux détecteurs
distincts (le Session Replay et le `onerror` global du SDK) ont vu la même
erreur. `-1E` est simplement la première fois que l'exception React elle-même
est remontée, avec sa pile (`throwOnHydrationMismatch`).

**`-1D` n'est pas une erreur d'hydratation** — c'est une invariante interne de
React (`beginWork` lit un `tag` de fiber aberrant), `handled: yes`. Hors
périmètre de cette spec (voir _Hors périmètre_).

### Les correctifs précédents ont fonctionné

Trois PR ont visé `NOMAQBANQ-5` : #127 et #130 (ancrage du formatage et des
branchements horaires sur le fuseau du Québec), #133 (refonte des états de
chargement). Sur les 33 événements des 90 derniers jours :

- **avant le 2026-07-28** : `/tableau-de-bord` en majorité, plus
  `/tableau-de-bord/examen-blanc` et `/admin`, sur desktop et mobile, toutes
  familles de navigateurs ;
- **après** : **3 événements**, tous sur `/tarifs`, depuis deux IP distinctes
  (Oakville ×2, Ottawa ×1), toutes Chrome Mobile 150 / Android 10.

Le dashboard est guéri. Le résidu est `/tarifs`.

### Le visiteur touché était connecté

Le replay `fae19f5b…` (encore dans la rétention au 2026-08-12) contient, après
`/tarifs`, des vues de `/tableau-de-bord` et
`/tableau-de-bord/examen-blanc/…/resultats`. Ces routes sont gardées côté
serveur par `requireSession()` — la session existait donc. C'est le fait qui
oriente le diagnostic : le mismatch touche un utilisateur **authentifié** sur
une page qui, elle, décide de son rendu à partir de la session **cliente**.

## Cause : `useSession` n'a pas de snapshot serveur neutre

`node_modules/better-auth/dist/client/react/react-store.mjs:41` :

```js
return useSyncExternalStore(subscribe, get, get)
```

Le troisième argument est `getServerSnapshot` — celui que React utilise pour le
**rendu d'hydratation**, côté client. Better Auth y passe `get`, la même
fonction que le snapshot client : elle renvoie ce que le store nanostores
contient à cet instant, pas une valeur neutre stable.

Conséquence : si la session est déjà résolue côté client au moment où React
hydrate (cache cookie Better Auth), le rendu d'hydratation voit
`{ data: user, isPending: false }` alors que le HTML serveur a été produit avec
`{ data: null, isPending: true }` — aucune session n'est résolue au SSR. Tout
composant qui **branche son rendu** sur cette valeur produit deux arbres
différents.

C'est le mécanisme que `.claude/rules/loading-ui.md` documentait déjà comme
diagnostiqué le 2026-07-29 sur la capture serveur/client de Sentry. Il est
désormais confirmé dans la source de la bibliothèque, et pas seulement déduit
d'une observation.

## Périmètre

Deux consommateurs de `useCurrentUser()` branchent leur rendu sur la session
alors qu'ils sont rendus côté serveur en premier.

### 1. `PricingGrid` — `/tarifs`

[`app/(marketing)/tarifs/_components/pricing-grid.tsx:32`](<../../../app/(marketing)/tarifs/_components/pricing-grid.tsx>)
appelle `useCurrentUser()`. Deux usages :

- **ligne 120** : `isAuthenticated && accessStatus && (…)` garde le bandeau
  « Vos accès actuels ». C'est le branchement de rendu fautif.
- **lignes 36-41** : `handlePurchase` sort tôt sur `isAuthLoading`, puis
  redirige vers `/inscription` si non authentifié.

L'information est **déjà présente côté serveur**.
`features/payments/dal.ts:43-46` : `getAccessStatus()` résout la session et
renvoie `null` si et seulement s'il n'y en a pas. La page
`app/(marketing)/tarifs/page.tsx:23-27` appelle déjà ce DAL et passe le résultat
en prop. Le composant redemande au client une information qu'il tient déjà.

**Défaut collatéral corrigé au passage** : le `if (isAuthLoading) return` de la
ligne 36 fait qu'un clic sur « Acheter » pendant la résolution de la session ne
produit **rien** — ni navigation, ni spinner, ni message. Une fois
`isAuthenticated` connu dès le premier rendu, cette branche disparaît.

### 2. `MarketingHeader` — toutes les pages marketing

[`components/marketing-header/index.tsx:37`](../../../components/marketing-header/index.tsx)
appelle `useCurrentUser()` et bascule (ligne 147) entre deux arbres DOM
franchement différents : avatar + `DropdownMenu`, ou deux boutons
`Connexion`/`Inscription`. `MobileMenu` reçoit `currentUser` et
`isAuthenticated` en props et fait le même choix.

`/`, `/domaines`, `/a-propos` et `/evaluation` sont en **ISR**
(`export const revalidate = 3600`) : leur HTML est généré une fois, déconnecté.
Un visiteur authentifié qui hydrate avec une session en cache y court le même
risque structurel que sur `/tarifs`.

**Statut honnête de ce second point** : le défaut est prouvé structurellement
(la bibliothèque ne fournit pas de snapshot serveur neutre), mais **pas** en
production — aucun événement Sentry sur `/`, `/faq` ou `/domaines`. On le
corrige comme durcissement, pas parce que les données le désignent. Cette
distinction doit rester lisible dans le message de commit.

## Design

### `PricingGrid` — descendre l'authentification depuis le serveur

`app/(marketing)/tarifs/page.tsx` résout explicitement la session
(`getCurrentSession()` de `lib/dal.ts`, déjà appelé en interne par
`getAccessStatus`, et mis en cache par React `cache()` — pas de requête
supplémentaire) et passe un booléen `isAuthenticated` à `TarifsPageClient`, qui
le relaie à `PricingGrid`.

`PricingGrid` perd son import de `useCurrentUser`. Le bandeau lit la prop ;
`handlePurchase` lit la prop et perd sa branche `isAuthLoading`.

Le booléen est passé **explicitement** plutôt que dérivé de
`accessStatus !== null`. La dérivation marcherait aujourd'hui, mais elle
transforme un détail d'implémentation du DAL en contrat de rendu : le jour où
`getAccessStatus` renverrait un objet pour un visiteur anonyme, le paywall
s'ouvrirait en silence. Une prop nommée casse à la compilation, une dérivation
implicite ne casse rien.

### `MarketingHeader` — neutraliser la frame d'hydratation

Le header reste un composant client (il a besoin de `usePathname`,
`useHeaderScroll`, des dropdowns). Il ne peut pas recevoir la session en prop
sans faire lire les cookies au layout marketing, ce qui **basculerait les quatre
pages ISR en dynamique** — régression inacceptable sur des pages marketing.

On garde donc la session cliente, mais on l'empêche de décider quoi que ce soit
pendant le rendu d'hydratation, avec le pattern déjà éprouvé dans le dépôt
(`components/shared/theme-toggle.tsx:20`) :

```ts
const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
```

`getServerSnapshot` renvoie une **constante**, donc le rendu d'hydratation
reproduit exactement le HTML serveur ; React bascule ensuite en rendu normal,
hors hydratation. Le branchement devient `mounted && isAuthenticated &&
currentUser`.

**Ce que voit l'utilisateur pendant cette frame** : la branche déconnectée
(`Connexion` / `Inscription`), c'est-à-dire exactement ce que le HTML serveur
contient déjà aujourd'hui. On n'introduit **pas** de squelette ni de
« Chargement… » : `.claude/rules/loading-ui.md` interdit un état de chargement
pour la session, et c'est précisément ce motif qui avait causé `NOMAQBANQ-5` sur
le dashboard. Le comportement visible est donc inchangé — seul son déterminisme
l'est.

Le helper `emptySubscribe` / le hook `mounted` est dupliqué dans deux fichiers
(`theme-toggle.tsx` et le header) : on l'extrait dans un hook partagé
`hooks/use-mounted.ts`, et `theme-toggle.tsx` l'adopte. Trois lignes, un seul
endroit où la subtilité `getServerSnapshot` est expliquée.

## Tests

Le point dur : un test qui passe que la garde existe ou non ne teste rien. Chaque
test ci-dessous doit être vérifié **discriminant** — on remet le défaut et le
test doit échouer.

- **`PricingGrid`** — le bandeau « Vos accès actuels » se rend à partir de la
  seule prop `isAuthenticated`, sans qu'aucune session cliente ne soit
  disponible (mock `authClient` absent / session `null`). Discriminance : avec
  l'ancien `useCurrentUser`, le bandeau ne se rend pas.
- **`PricingGrid`** — clic sur « Acheter » avec `isAuthenticated={false}` →
  `router.push("/inscription")` ; avec `true` → `createStripeCheckout` appelé.
  Couvre la disparition de la branche `isAuthLoading` (aujourd'hui : clic sans
  effet).
- **`MarketingHeader`** — sur `getServerSnapshot` (état non monté), le rendu
  produit la branche déconnectée **même quand `useCurrentUser` renvoie un
  utilisateur**. C'est le test qui vaut : il constate que la session ne peut
  plus décider pendant l'hydratation. Discriminance : sans la garde `mounted`,
  l'avatar apparaît.
- **`useMounted`** — `false` au snapshot serveur, `true` au snapshot client.

Le seuil de couverture du projet est à 80 % (`vitest.config.ts`) ; ces fichiers
sont déjà couverts, la refonte ne doit pas faire baisser la barre.

## Vérification en production

Le correctif ne se déclare pas réussi sur un test vert : les trois tentatives
précédentes passaient leurs tests aussi.

- `NOMAQBANQ-5` et `NOMAQBANQ-1E` sont marquées **résolues** au déploiement.
  Sentry les rouvre automatiquement si l'erreur réapparaît sur une release
  postérieure — c'est le signal à surveiller, sur au moins deux semaines.
- Si `-5` se rouvre sur une page marketing **autre** que `/tarifs`, c'est le
  header qui était en cause et le correctif H1 aura échoué (ou aura été
  contourné) : à noter dans l'issue plutôt qu'à redevine.

## Hors périmètre

- **`NOMAQBANQ-1D`** (`Unknown unit of work tag (9227)`,
  `/tableau-de-bord/examen-blanc/:examId/resultats`) : une occurrence,
  `handled: yes`, pas de duplication React côté build (`react` et `react-dom`
  en 19.2.8 uniques, plus le canary vendored par Next 16
  `19.3.0-canary-3f0b9e61-20260317`). Lead conservé pour un triage ultérieur :
  le replay de `-1E` contient l'URL du **même examen**
  (`0c91e8ea-f673-40e8-add7-52a93f1c3cee`) deux heures plus tôt depuis
  Edge/Windows — vraisemblablement la même personne, PC puis mobile. Une seule
  occurrence ne justifie pas une campagne.
- **Les cinq autres consommateurs de `useCurrentUser`**
  (`nav-secondary`, `onboarding-guard`, `onboarding-form`,
  `profile-personal-info`, `avatar-uploader`) : tous en zone `(dashboard)`, dont
  le layout garde déjà la session côté serveur. Risque réel mais non désigné par
  les données ; un balayage complet + une règle d'architecture ont été
  explicitement écartés de cette itération.
- **`Sentry.setUser`** : aucun appel dans le dépôt, donc `user.id` est toujours
  nul et les visiteurs ne se distinguent que par IP. C'est un angle mort
  d'observabilité réel — noté ici, pas traité ici.

## Règles à mettre à jour

`.claude/rules/loading-ui.md` porte déjà l'interdiction pour le shell dashboard
(« ne jamais réintroduire d'`authClient.useSession()` dans le shell »). Elle est
à généraliser avec le **pourquoi** désormais prouvé : `useSession` ne fournit pas
de `getServerSnapshot` neutre, donc tout branchement de rendu sur la session
cliente est un mismatch en puissance, y compris hors dashboard. Les deux issues
et le fichier `react-store.mjs` sont la preuve à citer.
