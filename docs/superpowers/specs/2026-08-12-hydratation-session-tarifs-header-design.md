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

## Cause : la session se résout PENDANT une hydratation longue

> Cette section a été réécrite après une revue adversariale. La première version
> affirmait que Better Auth exposait une session déjà en cache au rendu
> d'hydratation. **C'est faux**, et la correction est ci-dessous. Le diagnostic
> final ne repose plus sur une lecture de la bibliothèque mais sur le replay de
> l'incident.

### Ce que la bibliothèque fait vraiment

`node_modules/better-auth/dist/client/session-atom.mjs:29-35` — l'atome naît à
`{ data: null, error: null, isPending: true }`. Le seul chemin qui le peuple est
`onMount` → `setTimeout(…, 0)` → `fetchSession()`, soit un aller-retour réseau
(`session-atom.mjs:126-133`). Aucune lecture synchrone de cookie ou de
`localStorage` ne l'amorce ; le `cookieCache` de Better Auth est serveur.
`react-store.mjs:28,40-41` lit `useRef(store.get())` et renvoie
`useSyncExternalStore(subscribe, get, get)`.

Une session **déjà résolue** ne peut donc PAS être visible au premier rendu
client : `onMount` ne se déclenche qu'au premier `listen()`, qui vient du
`subscribe` de `useSyncExternalStore`, exécuté en effet passif après le commit.

### Ce qui se passe réellement

La session ne précède pas l'hydratation — elle **arrive pendant**. Reconstitué
depuis les segments d'enregistrement du replay
`fae19f5bd6594aa6af37e243808e861a` (voir _Preuve_) :

| Instant (vs erreur) | Fait |
| --- | --- |
| −963 ms | chargement de `/tarifs` |
| −826 ms | DOM servi : header en branche **déconnectée** ; badges d'accès des cartes présents (props serveur) ; bandeau de `PricingGrid` **absent** |
| 0 | `throwOnHydrationMismatch` |
| +246 ms | React régénère toute la racine ; apparaissent « LC » (initiales d'avatar), « Examens · 93j restants » et la phrase du bandeau |

L'appareil est un Android d'entrée de gamme (`Generic_Android K`, Android 10)
chargeant ~25 scripts dont un de 560 Ko. L'hydratation s'y étale sur plusieurs
frames. Le `setTimeout(0)` + l'aller-retour réseau de `fetchSession` se résolvent
à l'intérieur de cette fenêtre : le store change **entre** le commit d'une
frontière d'hydratation et l'hydratation de la suivante, et le sous-arbre que
React s'apprête à hydrater ne rend plus la même chose que le DOM servi.

C'est pour ça que le défaut est rare, qu'il ne touche que des appareils lents, et
qu'aucune reproduction locale ne l'a jamais montré.

### Conséquence sur le remède

La garde `mounted` n'est PAS un no-op. L'objection « `mounted && isAuthenticated`
est algébriquement égal à `isAuthenticated` » suppose que `isAuthenticated` ne
change pas pendant le rendu d'hydratation. Le replay prouve le contraire : c'est
exactement là qu'il change. `useMounted` renvoie `false` sur toute la durée de
l'hydratation, quel que soit le moment où le store se résout — c'est précisément
ce qui rend le balisage déterministe.

## Preuve

Le replay était encore dans la rétention. Les segments s'obtiennent par
`sentry api "/api/0/projects/khimera-9h/nomaqbanq/replays/<id>/recording-segments/?download=1"`
(tableau de segments, chacun un tableau d'événements rrweb). Le breadcrumb
`replay.hydrate-error` ne porte que l'URL — la valeur est dans le **snapshot
complet antérieur à l'erreur** (le DOM servi) et dans la **mutation de
récupération** qui suit (ce que React a réinséré).

Diff textuel entre les deux, par chaînes exactes :

```
présents côté serveur seulement : « Connexion », « Inscription »
présents côté client seulement  : « LC »,
                                  « Examens · 93j restants »,
                                  « Prolongez votre accès avant expiration
                                    pour cumuler le temps restant… »
```

**Rien d'autre ne diverge.** L'écart est exactement l'interface conditionnée par
la session : la branche d'authentification du header et le bandeau de
`PricingGrid`.

### Hypothèses concurrentes écartées, sur preuve

- **Formatage de devise** (`formatCurrency`, `Intl.NumberFormat("fr-CA")` — un
  U+00A0 côté Node contre un U+202F côté navigateur récent) : réfutée par
  l'incident lui-même. Les montants sont identiques des deux côtés, code point
  par code point — `350⟨U+00A0⟩$`, `600⟨U+00A0⟩$`, `250⟨U+00A0⟩$`,
  `200⟨U+00A0⟩$`, `50⟨U+00A0⟩$` avant comme après.
- **`next-themes` sur `<html>`** : `app/layout.tsx:135` porte déjà
  `suppressHydrationWarning`. Le `<style>` de `disableTransitionOnChange` visible
  dans la mutation est une conséquence de la régénération, pas sa cause.
- **Navigation cliente** : le `navigation.push` vers `/tarifs` relevé dans
  l'activité du replay vient du lien « Tarifs » de la barre de navigation ; une
  navigation cliente n'hydrate pas. Les deux snapshots postérieurs à l'erreur
  sont les re-captures que Sentry effectue au flush du buffer, pas de nouveaux
  chargements.

### Degré de confiance, explicitement

- **Prouvé** : l'unique divergence serveur/client est l'interface conditionnée
  par la session ; la session s'est résolue avant que React ne régénère l'arbre.
- **Non prouvé** : que le store ait muté à la tick exacte du rendu d'hydratation
  plutôt qu'entre deux frames de celui-ci. La distinction ne change pas le
  remède — les deux se corrigent en retirant la session du chemin de décision
  du rendu — mais elle doit rester écrite plutôt que lissée.

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

**Statut de ce second point — révisé.** La première version de ce document le
classait en durcissement non désigné par les données. Le replay a tranché
l'inverse : « Connexion » et « Inscription » sont les DEUX seules chaînes
présentes côté serveur et absentes côté client, et « LC » (les initiales
d'avatar du header) est la première apparue côté client. **Le header est un
contributeur prouvé du mismatch, au même titre que `PricingGrid`** — pas un
durcissement spéculatif.

Ce qui reste non désigné par les données, c'est le risque sur les autres pages
marketing : aucun événement Sentry sur `/`, `/faq` ou `/domaines`. Le correctif
les couvre par construction, ce n'est pas une raison de prétendre qu'elles
étaient cassées.

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
à généraliser avec le **pourquoi** désormais établi : la session Better Auth se
résout par un aller-retour réseau déclenché au montage, et sur un appareil lent
elle atterrit **pendant** l'hydratation. Tout branchement de rendu sur elle est
donc un mismatch en puissance, y compris hors dashboard — d'autant plus rare et
d'autant plus difficile à reproduire que la machine de développement est rapide.

Deux corollaires à écrire dans la règle :

- ce n'est **pas** un défaut de la bibliothèque à contourner, c'est le
  comportement normal d'un état asynchrone client ; le remède est de ne pas le
  laisser décider du balisage initial ;
- une reproduction locale qui échoue ne prouve rien. Le levier est le **temps
  d'hydratation** : throttling CPU/réseau, ou un appareil réel d'entrée de gamme.
