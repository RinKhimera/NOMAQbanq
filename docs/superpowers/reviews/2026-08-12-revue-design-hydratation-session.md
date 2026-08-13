# Revue adversariale de conception — Hydratation : session cliente sur `/tarifs` et header

## 1. En-tête

- **Date** : 2026-08-12
- **Branche** : `fix/hydratation-session-tarifs-header` (2 commits de docs, `git status` propre, aucun code modifié)
- **Périmètre relu**
  - Spec : `docs/superpowers/specs/2026-08-12-hydratation-session-tarifs-header-design.md`
  - Plan : `docs/superpowers/plans/2026-08-12-hydratation-session-tarifs-header.md`
  - Code réel confronté : `app/(marketing)/tarifs/page.tsx`, `.../_components/{tarifs-page-client,pricing-grid,pricing-header}.tsx`,
    `components/marketing-header/{index,mobile-menu,use-header-scroll}.tsx`, `components/shared/theme-toggle.tsx`,
    `components/shared/user-avatar.tsx`, `components/shared/payments/{pricing-card,access-badge}.tsx`,
    `components/shared/{marketing-shell,footer}.tsx`, `app/(marketing)/layout.tsx`, `app/layout.tsx`,
    `features/payments/{dal,actions}.ts`, `lib/{dal,auth-guards,auth-client,format}.ts`, `hooks/useCurrentUser.ts`,
    `tests/helpers/motion-mock.tsx`, `vitest.config.ts`, `prettier.config.mjs`, `package.json`
  - Bibliothèques lues dans `node_modules` : `better-auth@1.6.25` (`client/react/{index,react-store}.mjs`,
    `client/{config,session-atom,session-refresh}.mjs`, `client/plugins/index.mjs`),
    `react-dom@19.2.8` (`cjs/react-dom-client.development.js`, `server.browser.js`)
  - Règles projet : `AGENTS.md`, `.claude/rules/{loading-ui,data-layer,payments,seo}.md`
- **Méthode** : lecture seule, hostile. Chaque constat est prouvé contre l'arbre courant avec `fichier:ligne` et la
  commande rejouable. Chaque défaut suspecté a subi une tentative de réfutation ; les morts sont consignés en §4.
- **Gate** : `bun run check` → **exit code 0** (prettier + `tsc --noEmit` + `eslint --max-warnings 0`). La base est verte
  avant implémentation.

---

## 2. Tableau des constats

| #   | Sév | fichier:ligne                                                          | problème                                                                                                                        | régression ? |
| --- | --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | 🔴  | `node_modules/better-auth/dist/client/session-atom.mjs:26-31,127-133`   | La cause racine décrite est **irréalisable** : l'atome session vaut toujours `{data:null,isPending:true}` au rendu d'hydratation. Le mismatch visé ne peut pas se produire ; la garde `mounted` du header est un no-op prouvé. | NON          |
| 2   | 🔴  | spec §« Cause », plan §« Pourquoi c'est un vrai bug »                   | La preuve décisive (diff serveur/client attaché à l'exception React de `NOMAQBANQ-1E`) existe encore et n'a pas été consultée. Le plan conclut par élimination. | N/A          |
| 3   | 🟠  | `lib/format.ts:31-53` · `components/shared/payments/pricing-card.tsx:207` | Candidat alternatif jamais inventorié : `Intl.NumberFormat("fr-CA", {style:"currency"})` rendu au SSR sur chaque carte. Écart d'espace insécable entre l'ICU de Node et celui du navigateur = mismatch invisible, propre à `/tarifs`. | NON (préexistant) |
| 4   | 🟠  | `node_modules/better-auth/dist/client/session-refresh.mjs:12,50-61`     | Geler `isAuthenticated` au SSR supprime le rafraîchissement au focus et la synchro inter-onglets : header (avatar) et grille (« non connecté ») divergent sur la même page. | **OUI**      |
| 5   | 🟠  | `vitest.config.ts:39-45`                                                | `app/**` n'est pas dans `coverage.include` : le correctif principal (`pricing-grid.tsx`) n'est pas mesuré non plus. L'affirmation de Task 6 Step 2 est incomplète. | NON          |
| 6   | 🟡  | plan Task 4 Step 3                                                      | Ordre d'import faux : `@/hooks/use-mounted` doit précéder `@/hooks/useCurrentUser` → `bun run check` échoue au Step 6.            | NON          |
| 7   | 🟡  | plan Task 1 S2/S5, Task 2 S2/S4, Task 4 S2/S4                           | `bun run test -- <fichier>` ne filtre pas (1287 tests au lieu de 19). Les étapes « Attendu : 2 tests PASS » sont invérifiables.  | NON          |
| 8   | 🟡  | `app/(marketing)/tarifs/_components/pricing-grid.tsx:45`                | `await` d'une Server Action sans `callAction` : le plan réécrit `handlePurchase` sans corriger le trou deploy-skew imposé par `.claude/rules/data-layer.md`. | NON (préexistant) |
| 9   | ℹ️  | plan Task 4 Step 1, test `MarketingHeader`                              | `expect(html).not.toContain("Awa Diallo")` est vrai par construction, garde ou pas : le nom n'est jamais rendu au SSR.            | NON          |

---

## 3. Détail par constat

### 🔴 #1 — Le store Better Auth est *toujours* en attente au rendu d'hydratation : le mismatch décrit ne peut pas se produire

**Code**

- `node_modules/better-auth/dist/client/session-atom.mjs:26-31` — l'atome est créé à
  `{ data: null, error: null, isPending: true, isRefetching: false, refetch }`.
- `session-atom.mjs:127-133` — `onMount(session, () => { … if (!isServer()) timeoutId = setTimeout(() => { fetchSession() }, 0) … })`.
  Le seul chemin qui peuple l'atome est un `setTimeout(…, 0)` **suivi d'un aller-retour réseau** vers `/get-session`.
- `client/react/react-store.mjs:28` — `const snapshotRef = useRef(store.get())` : évalué **pendant le rendu**, donc
  pendant le rendu d'hydratation.
- `react-store.mjs:30-39` — `subscribe` (donc le `listen()` qui déclenche `onMount`) est passé à `useSyncExternalStore`,
  que React exécute dans un **effet passif, après le commit d'hydratation**
  (`react-dom/cjs/react-dom-client.development.js:8143-8146` : `mountEffect(subscribeToStore.bind(…))`).
- `client/config.mjs:54-90` — l'atome `session` n'est jamais souscrit à l'initialisation ; `$store.listen` (l.86-87) est
  un utilitaire offert aux plugins, et `client/plugins/index.mjs` ne contient ni `$store`, ni `listen(`, ni `getActions`.

**Pourquoi c'est un vrai défaut**

La spec pose comme prémisse : « si la session est **déjà résolue** côté client au moment où React hydrate (cache cookie
Better Auth) ». Cette prémisse est fausse pour la version installée. Il n'existe **aucune** lecture synchrone de cookie
ou de `localStorage` qui amorcerait le store : au premier rendu client, l'atome est neuf et la requête n'a même pas été
lancée. Donc au rendu d'hydratation de `/tarifs` :

- `useCurrentUser()` → `isAuthenticated = false`, `isLoading = true` — **identique au SSR** ;
- `pricing-grid.tsx:120` (`isAuthenticated && accessStatus && …`) → bandeau absent des deux côtés ;
- `marketing-header/index.tsx:147` (`isAuthenticated && currentUser`) → branche déconnectée des deux côtés.

Le mécanisme `getServerSnapshot === get` (`react-store.mjs:41`) est réellement présent et correctement décrit — mais il
est **inatteignable** ici, parce que la valeur qu'il renvoie est justement la valeur neutre.

Corollaire dur sur la tâche 4 : `showUser = useMounted() && isAuthenticated` est **algébriquement équivalent à
`isAuthenticated`**. `useMounted()` ne vaut `false` que pendant un rendu d'hydratation, et pendant un rendu
d'hydratation `isAuthenticated` vaut déjà nécessairement `false`. La garde ne peut donc jamais changer le balisage
produit. Le test de discriminance du plan (Task 4 Step 5) ne passera au vert que parce que le test **mocke**
`useCurrentUser` pour renvoyer un utilisateur — situation qui ne se produit pas en production.

**Échappatoire examinée et écartée** : une hydratation différée (une frontière `<Suspense>` hydratée après qu'une autre
a déjà déclenché le fetch) ferait lire un store peuplé. Mais `/tarifs` n'a **ni `loading.tsx` ni `<Suspense>`** —
`find "app/(marketing)" -name loading.tsx` ne renvoie que `evaluation/` et `evaluation/quiz/`, et
`grep -rn "Suspense" "app/(marketing)" components/shared/marketing-shell.tsx components/marketing-header` ne renvoie
rien. `MarketingHeader` (layout) et `PricingGrid` (page) hydratent et committent dans la même passe.

**Régression ?** NON — le correctif n'abîme rien de ce côté. Mais il **ne corrige pas** `NOMAQBANQ-5` / `-1E`.

**Comment je l'ai prouvé**

```bash
cat node_modules/better-auth/dist/client/session-atom.mjs        # atom() initial + onMount/setTimeout
sed -n '50,110p' node_modules/better-auth/dist/client/config.mjs # aucune souscription à `session`
grep -rn 'localStorage|document.cookie' node_modules/better-auth/dist/client/*.mjs
#   → seul node_modules/better-auth/dist/client/broadcast-channel.mjs:19 (émission BroadcastChannel, pas une graine)
grep -rn '\$store|listen\(|getActions' node_modules/better-auth/dist/client/plugins/index.mjs   # → aucun résultat
find "app/(marketing)" -name loading.tsx                          # → evaluation/ uniquement
```

**Correctif suggéré**

1. Ne pas présenter ce plan comme le correctif de `NOMAQBANQ-5`. Reprendre le diagnostic (voir #2 et #3).
2. Garder la tâche 1 (prop serveur) : elle reste un vrai gain (voir plus bas), mais sous un autre motif — supprimer le
   clic mort et le saut visuel du bandeau après hydratation, pas « corriger un mismatch ».
3. Trancher la tâche 4 : soit l'assumer comme durcissement défensif contre une future version de Better Auth qui
   amorcerait le store — et l'écrire ainsi dans le commit ET dans le test — soit la retirer. Telle qu'écrite, elle
   affirme corriger quelque chose qu'elle ne corrige pas.

---

### 🔴 #2 — La preuve décisive existe et n'a pas été lue

**Code / données**

- Spec l.14-22 : `NOMAQBANQ-1E` est « la première fois que l'exception React elle-même est remontée, avec sa pile
  (`throwOnHydrationMismatch`) », et le replay `fae19f5b…` était encore en rétention le 2026-08-12.
- Spec l.115-119 : l'auteur reconnaît lui-même que le second point n'est « pas prouvé en production ».
- Spec l.91-95 puis §« Vérification en production » : la conclusion vient d'un balayage de l'arbre `/tarifs`, pas de
  l'événement.

**Pourquoi c'est un vrai défaut**

React 19 attache à l'erreur d'hydratation un diff (texte serveur attendu / texte client obtenu) et une pile de
composants. `.claude/rules/loading-ui.md` atteste que l'équipe sait déjà exploiter cette « capture serveur/client de
Sentry » — c'est exactement comme ça que la cause du 2026-07-29 a été établie. Ici on dispose d'un événement diagnostique
unique et encore consultable, et le plan choisit de raisonner par élimination. Trois tentatives (#127, #130, #133) ont
déjà échoué sur cette issue ; la quatrième ne devrait pas repartir d'une déduction.

**Régression ?** N/A (défaut de méthode).

**Comment je l'ai prouvé** : lecture de la spec l.14-22 / l.115-119 et de `.claude/rules/loading-ui.md`
(section « Pas d'état de chargement pour la session »), qui documente la capture serveur/client comme outil de
diagnostic déjà employé.

**Correctif suggéré** : avant toute ligne de code, ouvrir `NOMAQBANQ-1E` et relever le diff serveur/client + la pile de
composants. Le nœud fautif y est nommé. Si c'est bien `PricingGrid`, #1 est réfuté et le plan repart tel quel ; sinon on
évite une quatrième tentative à l'aveugle. Lecture seule côté Sentry — je n'ai muté aucune issue.

---

### 🟠 #3 — Candidat alternatif jamais inventorié : `Intl.NumberFormat` au SSR

**Code**

- `lib/format.ts:31-53` — `formatCurrency` termine par
  `new Intl.NumberFormat("fr-CA", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)`.
- `components/shared/payments/pricing-card.tsx:207` — `{formatCurrency(product.priceCAD)}`, rendu côté serveur sur
  **chaque** carte de `/tarifs`.
- `components/shared/payments/premium-pricing-card.tsx:168,172,188` — trois occurrences de plus sur la même page.

**Pourquoi c'est un vrai défaut**

Node 24.13 / ICU 77.1 produit `300 $` — codepoints `U+0033 U+0030 U+0030 U+00A0 U+0024`. Le séparateur est une
espace insécable **U+00A0**. Depuis CLDR 42 / ICU 72, plusieurs locales francophones ont basculé ce séparateur vers
**U+202F** (espace insécable étroite). Un navigateur dont l'ICU diffère de celui de Node rend donc un caractère
différent — invisible à l'œil, mais un mismatch de nœud texte pour React.

Ce candidat explique tout ce que le diagnostic « session » explique, et davantage :

- il est **spécifique à `/tarifs`** parmi les pages marketing : `grep -rn "formatCurrency" app components --include=*.tsx`
  ne le trouve nulle part dans `/`, `/domaines`, `/a-propos`, `/evaluation` ni dans le header ou le footer ;
- il est **spécifique au terminal**, ce qui colle aux données Sentry (3 événements résiduels, tous Chrome Mobile 150 /
  Android 10, deux IP) — alors qu'un défaut de session frapperait tout le monde ;
- il **survit** à #127, #130 et #133, qui n'ont touché que le fuseau horaire et les états de chargement ;
- la règle projet ne protège pas : `.claude/rules/data-layer.md` exige « toujours passer une locale fixe », ce qui
  neutralise l'écart de locale par défaut mais **pas** l'écart de version ICU entre Node et le navigateur.

Je ne peux pas confirmer le rendu de Chrome Mobile 150 depuis cette session : je le donne comme hypothèse concurrente
sérieuse et testable, pas comme fait établi.

**Régression ?** NON — préexistant. Mais c'est probablement la vraie cause, et le plan ne la mentionne nulle part.

**Comment je l'ai prouvé**

```bash
node -e "const s=new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD',minimumFractionDigits:0,maximumFractionDigits:2}).format(300);
console.log(process.versions.icu, JSON.stringify(s), [...s].map(c=>'U+'+c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')).join(' '))"
#   77.1 "300 $" U+0033 U+0030 U+0030 U+00A0 U+0024
grep -rn "formatCurrency" app components --include=*.tsx
```

**Correctif suggéré**

- Vérification décisive et gratuite : le diff de `NOMAQBANQ-1E` (#2) montrera un écart sur un nœud de prix si c'est ça.
- Si confirmé : formater les prix **au serveur** (le DAL renvoie déjà `priceCAD`, il peut renvoyer la chaîne) ou
  remplacer `Intl` par un formatage déterministe maison — c'est la seule façon de rendre le rendu insensible à l'ICU du
  client. Étendre alors la règle `data-layer.md` : « locale explicite » ne suffit pas, `Intl.*` dans un composant rendu
  côté serveur est un mismatch en puissance.

---

### 🟠 #4 — Geler `isAuthenticated` au SSR casse le rafraîchissement au focus et la synchro inter-onglets

**Code**

- `node_modules/better-auth/dist/client/session-refresh.mjs:12` — `refetchOnWindowFocus = options.sessionOptions?.refetchOnWindowFocus ?? true` :
  **activé par défaut**, et `lib/auth-client.ts` ne passe aucune `sessionOptions`.
- `session-refresh.mjs:50-61` — `setupBroadcast()` (BroadcastChannel inter-onglets) et `setupFocusRefetch()`
  (`visibilitychange`) déclenchent `fetchSession()`.
- `session-atom.mjs:135-137` — le manager est initialisé au montage de l'atome, donc dès qu'un composant appelle
  `useSession()`.
- Plan Task 1 Step 3 : `pricing-grid.tsx` perd `useCurrentUser()` et lit une prop figée au rendu serveur.
- Plan Task 4 Step 3 : `marketing-header/index.tsx` **conserve** `useCurrentUser()`.

**Pourquoi c'est un vrai défaut**

Scénario concret et banal : un visiteur ouvre `/tarifs` déconnecté, se connecte dans un second onglet, revient sur le
premier. Aujourd'hui, le BroadcastChannel + le refetch au focus repeuplent le store : le header affiche l'avatar **et**
le bouton « Acheter » ouvre le checkout. Après le plan, le header affiche toujours l'avatar (il garde le hook) mais la
grille lit une prop figée à `false` → le clic « Acheter » déclenche `router.push("/inscription")`
(`pricing-grid.tsx:38-41`). Deux composants de la même page affirment deux choses contradictoires, et le parcours
d'achat est le perdant.

Le cas symétrique évoqué par l'auteur (session **morte** entre le SSR et le clic) est en revanche couvert : voir §5 Q4.

**Régression ?** **OUI** — perte d'une mise à jour que le code actuel produit.

**Comment je l'ai prouvé**

```bash
cat node_modules/better-auth/dist/client/session-refresh.mjs   # refetchOnWindowFocus ?? true, setupBroadcast, setupFocusRefetch
cat lib/auth-client.ts                                          # aucune sessionOptions → défauts actifs
```

**Correctif suggéré** : garder la prop serveur comme **valeur initiale déterministe** et laisser la session cliente la
relever une fois montée, par exemple `const authed = isAuthenticated || (mounted && clientAuthenticated)`. On conserve
le premier rendu déterministe (objectif du plan) sans perdre la fraîcheur. À défaut, accepter la régression
explicitement et l'écrire dans la spec — mais alors le header devrait recevoir le même traitement, sinon l'incohérence
inter-composants reste.

---

### 🟠 #5 — La couverture ne mesure pas le correctif principal, et le plan ne le dit qu'à moitié

**Code**

- `vitest.config.ts:39-45` — `coverage.include = ["lib/**/*.ts", "hooks/**/*.ts", "components/**/*.tsx", "schemas/**/*.ts", "email/**/*.{ts,tsx}"]`.
  **`app/**` est absent de la liste d'inclusion.**
- `vitest.config.ts:81,83` — `components/shared/theme-toggle.tsx` et `components/marketing-header/**` sont en plus
  explicitement exclus.
- Plan Task 6 Step 2 : « `components/marketing-header/**` et `components/shared/theme-toggle.tsx` sont exclus de la
  couverture ; `hooks/use-mounted.ts` y entre et est couvert par la tâche 2. »

**Pourquoi c'est un vrai défaut**

L'affirmation est vraie mais incomplète, et l'omission porte sur le morceau qui compte : `PricingGrid` vit dans
`app/(marketing)/tarifs/_components/`, donc **il n'est pas mesuré non plus**. Sur les trois fichiers de production
touchés, le seul qui entre dans la métrique est `hooks/use-mounted.ts` — trois lignes triviales. Le pourcentage de
couverture montera (ou restera) sans que rien du code corrigé ne soit mesuré. Ce n'est pas une tricherie du plan, mais
c'est exactement le motif « couverture qui monte sans mesurer le correctif » que la campagne vitest-audit a voulu
éliminer. La valeur des tests `PricingGrid` reste réelle — elle est juste invisible à la métrique, et le plan devrait le
dire pour que personne ne lise le seuil vert comme une garantie.

**Régression ?** NON.

**Comment je l'ai prouvé** : lecture de `vitest.config.ts:37-121` ; `app/**` n'apparaît que dans `coverage.exclude`
(l.51-54), jamais dans `include`.

**Correctif suggéré** : corriger la phrase de Task 6 Step 2 (« aucun des deux fichiers de composant modifiés n'est
mesuré ; seul `hooks/use-mounted.ts` entre dans la métrique »). Décision d'ajouter `app/**/_components/**` à
`coverage.include` : hors périmètre de cette itération, à proposer séparément.

---

### 🟡 #6 — Ordre d'import : `bun run check` échouera au Step 6 de la tâche 4

**Code**

Plan Task 4 Step 3 :

```diff
 import { useCurrentUser } from "@/hooks/useCurrentUser"
+import { useMounted } from "@/hooks/use-mounted"
```

`prettier.config.mjs` charge `@trivago/prettier-plugin-sort-imports` avec
`importOrder: ["^(node:(.*)$)|^([a-zA-Z0-9].*)$", "^@/(.*)$", "^[./]"]`.

**Pourquoi c'est un vrai défaut**

Dans le groupe `^@/(.*)$`, le tri compare les chaînes : `use-` (`U+002D`) précède `useC` (`U+0043`). L'ordre prescrit
par le plan est donc inversé, et `prettier --check` — premier maillon de `bun run check` — échoue. Le plan s'arrête
alors juste avant son commit. Détail, mais qui bloque une étape nommée dans le plan.

Note : les deux autres insertions d'import du plan sont correctes — `@/hooks/use-mounted` après
`@/components/ui/dropdown-menu` dans `theme-toggle.tsx` (Task 2 Step 5) et `@/lib/dal` après `@/features/payments/dal`
dans `page.tsx` (Task 1 Step 4).

**Régression ?** NON.

**Comment je l'ai prouvé**

```bash
printf 'import { useCurrentUser } from "@/hooks/useCurrentUser"\nimport { useMounted } from "@/hooks/use-mounted"\n' \
  | bunx prettier --stdin-filepath x.tsx
# → use-mounted ressort en premier
```

**Correctif suggéré** : intervertir les deux lignes dans le diff du plan.

---

### 🟡 #7 — `bun run test -- <fichier>` ne filtre rien : les étapes TDD du plan sont invérifiables

**Code**

- `package.json` → `"test": "vitest run --project frontend"`.
- Plan Task 1 Steps 2 & 5, Task 2 Steps 2 & 4, Task 4 Steps 2 & 4 : `bun run test -- tests/…`.

**Pourquoi c'est un vrai défaut**

Le `--` est consommé comme fin d'options ; le chemin n'atteint pas les filtres positionnels de Vitest et la suite
entière tourne. Les attendus du plan (« ÉCHEC », « 2 tests PASS », « 4 tests PASS ») deviennent illisibles au milieu de
1287 tests, et la vérification de discriminance — le point que la spec désigne elle-même comme le point dur — perd son
signal.

**Régression ?** NON.

**Comment je l'ai prouvé**

```bash
bunx vitest list --project frontend -- tests/components/payments/PricingCard.test.tsx | wc -l   # → 1287
bunx vitest list --project frontend    tests/components/payments/PricingCard.test.tsx | wc -l   # →   19
```

**Correctif suggéré** : retirer le `--` partout — `bun run test tests/components/payments/PricingGrid.test.tsx`.

---

### 🟡 #8 — `handlePurchase` reste un `await` d'action serveur hors `callAction`

**Code**

- `app/(marketing)/tarifs/_components/pricing-grid.tsx:44-63` — `const res = await createStripeCheckout({…})` dans un
  `try/catch` maison.
- `.claude/rules/data-layer.md`, § « Appels client de Server Actions » : « Mutations : `callAction(() => action(x))`
  (`lib/safe-action.ts`) », avec détection `UnrecognizedActionError` et toast « Recharger » central.

**Pourquoi c'est un vrai défaut**

Le `try/catch` couvre bien le rejet réseau (le code affiche déjà un message hors-ligne), mais pas le **deploy skew** :
après un déploiement, un onglet resté ouvert appelle une référence d'action périmée et l'utilisateur reçoit
« Une erreur est survenue. Veuillez réessayer. » — message qui masque le seul remède (recharger), sur un bouton de
paiement. C'est précisément le cas que `callAction` a été écrit pour couvrir. Le plan réécrit cette fonction (Task 1
Step 3) et laisse le trou.

**Régression ?** NON — préexistant, mais l'occasion de le fermer est dans le périmètre édité.

**Comment je l'ai prouvé** : lecture de `pricing-grid.tsx:44-63` et de `.claude/rules/data-layer.md`.

**Correctif suggéré** : passer par `callAction(() => createStripeCheckout({…}))` et lire le retour discriminé, en même
temps que la suppression de la branche `isAuthLoading`. Une ligne, dans une fonction déjà ouverte par le plan.

---

### ℹ️ #9 — Une assertion du test `MarketingHeader` est vraie par construction

**Code**

- Plan Task 4 Step 1 : `expect(html).not.toContain("Awa Diallo")`.
- `components/marketing-header/index.tsx:167-178` — le nom n'est rendu que dans `DropdownMenuContent`, sous
  `open={isUserMenuOpen}` qui vaut `false` au premier rendu : Radix ne rend rien.
- `components/shared/user-avatar.tsx:30` — `alt={name}` est porté par `AvatarImage`, que Radix n'émet qu'une fois
  l'image chargée — jamais au rendu serveur.

**Pourquoi c'est un vrai défaut** : l'assertion passe avec ou sans la garde. Elle donne l'impression de vérifier
« aucune donnée utilisateur ne fuit dans le HTML serveur » alors qu'elle ne vérifie rien. Seul
`expect(html).toContain("Connexion")` discrimine réellement (sans garde, la branche connectée est rendue et
« Connexion » disparaît, y compris de `MobileMenu` qui est fermé).

**Régression ?** NON.

**Comment je l'ai prouvé** : lecture de `index.tsx:147-222`, `mobile-menu.tsx:59-64,204-224` (le `SheetContent` n'est
monté que si `isOpen`), `user-avatar.tsx:29-34`.

**Correctif suggéré** : supprimer l'assertion, ou la remplacer par une qui porte — par exemple l'absence des initiales
du fallback (`"AD"`), effectivement rendues par `AvatarFallback` dans la branche connectée.

---

## 4. Faux positifs écartés

| Soupçon                                                                                                  | Preuve qui l'a tué                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Les ancres de ligne du plan ont bougé                                                                    | Toutes vérifiées exactes : `pricing-grid.tsx:32,36-41,120` · `marketing-header/index.tsx:20,37,147,247-248` · `theme-toggle.tsx:20` · `pricing-card.tsx:285` (« Acheter maintenant ») · `motion-mock.tsx:96` (fin de l'entrée `circle`) · `lib/dal.ts:7` · `features/payments/dal.ts:43-46` · `page.tsx:23-27`. Les chaînes à remplacer existent littéralement. |
| `mobile-menu.tsx` doit être modifié (fuite de `currentUser` non gardé)                                   | `mobile-menu.tsx:145` : `{isAuthenticated && currentUser ? (…)}`. La branche connectée est intégralement sous la garde. Passer `isAuthenticated={showUser}` suffit — le plan a raison. |
| `renderToString` est absent du build `browser` de `react-dom`, le test de la tâche 2 ne compilera pas    | `node_modules/react-dom/server.browser.js` : `exports.renderToString = l.renderToString` (build legacy). Disponible par la condition `browser` **comme** par `node`.          |
| `getCurrentSession()` ajouté au `Promise.all` = deuxième lecture de session en base                       | `lib/dal.ts:7` : `cache(async () => auth.api.getSession(…))`. `getAccessStatus` (`features/payments/dal.ts:43`) appelle la même fonction mémoïsée dans le même scope de requête ; les deux appels concurrents partagent la promesse. Une seule lecture. |
| Passer `isAuthenticated` en prop bascule des pages ISR en dynamique                                      | Les 4 pages ISR sont `app/(marketing)/{page,domaines/page,a-propos/page,evaluation/page}.tsx` (`revalidate = 3600`). `/tarifs` n'en fait pas partie et est déjà dynamique (`getAccessStatus` → `headers()`). Aucune édition ne touche `app/(marketing)/layout.tsx` ni `marketing-shell.tsx`. |
| Le libellé du bouton serait « Prolonger l'accès » dans les deux tests de clic                            | `pricing-card.tsx:285` bascule sur `hasAccess = !!currentAccess`. Les tests passent `accessStatus: null` et `{examAccess:null,trainingAccess:null}` → `getCurrentAccess` renvoie `null` → « Acheter maintenant ». La note du plan est juste. |
| Le `new Date().getFullYear()` du footer est la vraie cause du mismatch                                    | `components/shared/footer.tsx:17` : `const CURRENT_YEAR = getAppZoneYear(Date.now())` au scope module, ancré sur le fuseau applicatif. Pas de recalcul au rendu.              |
| Le test `PricingGrid` ne mocke pas `@/lib/auth-client` → rejet réseau non géré en happy-dom               | `session-atom.mjs:110-121` : le `fetchSession` est enveloppé d'un `catch (fetchError)` qui range l'erreur dans l'atome. Aucun rejet non géré ne remonte.                       |
| La garde `mounted` est illusoire sous rendu concurrent / `<Suspense>`                                     | `react-dom/cjs/react-dom-client.development.js:8112-8117` : `mountSyncExternalStore` teste `isHydrating` et emprunte `getServerSnapshot()` pour **tout** fiber hydraté. Voir §5 Q1. |
| Les décomptes de la spec (« 3 événements », « les cinq autres consommateurs ») sont approximatifs        | `grep -rln useCurrentUser app components hooks` → 7 fichiers + le hook : `pricing-grid` et `marketing-header` (périmètre) + exactement `nav-secondary`, `onboarding-guard`, `onboarding-form`, `profile-personal-info`, `avatar-uploader`. Le compte est exact. Les 4 pages ISR annoncées sont exactement les 4 trouvées. |

---

## 5. Réponses aux questions ouvertes

### Q1 — La garde `mounted` tient-elle vraiment ?

**Oui, techniquement.** `react-dom/cjs/react-dom-client.development.js:8109-8123` :

```js
function mountSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
  …
  if (isHydrating) {
    if (void 0 === getServerSnapshot) throw Error("Missing getServerSnapshot…")
    var nextSnapshot = getServerSnapshot()
  } else { nextSnapshot = getSnapshot() … }
```

`isHydrating` est un drapeau du rendu en cours, pas une propriété de la racine : il est positionné pour **tout** fiber
que React est en train d'hydrater, y compris à l'intérieur d'une frontière `<Suspense>` hydratée tardivement et sous
rendu concurrent. Les deux cas où React appelle `getSnapshot()` au premier montage sont (a) un rendu client normal —
pas d'hydratation, donc pas de HTML serveur à contredire — et (b) un sous-arbre dont React **abandonne** l'hydratation
pour le rendre côté client : le HTML serveur correspondant est alors jeté, il n'y a rien à faire diverger. Un composant
qui suspend puis reprend passe par `updateSyncExternalStore` (l.8162-8223), qui compare au snapshot mémorisé — même
conclusion.

**Mais la garde est sans effet ici**, pour la raison du constat #1 : elle ne peut valoir `false` que pendant un rendu
d'hydratation, moment où `isAuthenticated` vaut déjà `false` par construction. `useMounted() && isAuthenticated` ≡
`isAuthenticated`.

### Q2 — Le diagnostic est-il seulement le bon ?

**Non, pas tel qu'il est écrit — et c'est le constat le plus important de cette revue.**

1. Le mécanisme invoqué est **inatteignable** : le store Better Auth est neuf et vide au rendu d'hydratation (constat
   #1, prouvé dans `session-atom.mjs`, `config.mjs` et `plugins/index.mjs`). Il n'existe aucun « cache cookie » côté
   client — le `cookieCache` de Better Auth est une optimisation **serveur**, elle n'amorce rien dans le navigateur.
2. Votre intuition sur le replay est fondée mais ne mène pas là où vous le craigniez. Un `navigation.push` vers
   `/tarifs` alors qu'on y est déjà s'explique trivialement : `marketing-header/index.tsx:25-31` déclare `/tarifs` dans
   la nav, et `mobile-menu.tsx:94-111` la rend aussi — l'utilisateur a tapé « Tarifs » en étant sur `/tarifs`. Ce n'est
   donc pas une preuve de bfcache ni de double montage. En revanche, votre conclusion tient pour une autre raison : une
   navigation cliente **n'hydrate pas**, donc cette séquence ne peut pas être le déclencheur, et le plan ne l'a jamais
   expliqué.
3. **Cause alternative concrète** : `formatCurrency` (constat #3). `Intl.NumberFormat("fr-CA", {style:"currency"})` rend
   au SSR sur les 4+ cartes de `/tarifs` et nulle part ailleurs dans le marketing ; Node/ICU 77 émet `U+00A0`, un
   navigateur au CLDR plus récent émet `U+202F`. Invisible, spécifique au terminal, spécifique à `/tarifs`, insensible
   aux trois correctifs précédents — toutes les signatures observées.
4. Deuxième piste à ne pas écarter : la mutation DOM tierce déjà connue du dépôt. `instrumentation-client.ts:44-46`
   filtre les crashs `$RS` attribués à un tiers (traduction, extension, proxy). Un volume de 3 événements en 90 jours,
   depuis 2 IP, tous sur Chrome Mobile 150 / Android 10, est aussi la signature d'un ou deux utilisateurs dont le
   navigateur réécrit le DOM (traduction automatique mobile).

**Recommandation** : ouvrir le diff serveur/client de `NOMAQBANQ-1E` avant d'écrire du code. Il nomme le nœud fautif et
départage en cinq minutes les hypothèses 1, 3 et 4.

### Q3 — `getCurrentSession()` ajouté au `Promise.all` est-il gratuit ?

**Oui, le plan a raison.** `lib/dal.ts:7` enveloppe `getCurrentSession` dans React `cache()`. `getAccessStatus`
(`features/payments/dal.ts:39-46`) appelle exactement cette fonction mémoïsée quand `userId` est absent — ce qui est le
cas ici, la page l'appelle sans argument. Les deux appels partent concurremment dans le même `Promise.all`, donc dans le
même scope de requête React : le second reçoit la promesse déjà mémoïsée. **Une seule** exécution de
`auth.api.getSession`, donc une seule lecture de session en base par rendu de `/tarifs`. Aucune requête ajoutée.

### Q4 — Session morte entre le SSR et le clic

**Le garde serveur couvre le cas, et on ne perd rien de ce côté.** `createStripeCheckout`
(`features/payments/actions.ts:331`) commence par `await requireSession()`, qui appelle `redirect("/connexion")`
(`lib/auth-guards.ts:6-10`) si la session a disparu. L'utilisateur est donc renvoyé vers la connexion — aucun accès
n'est octroyé à tort, aucune session Stripe n'est créée.

Deux réserves :

- Le message affiché est médiocre. Le `redirect()` d'une Server Action ne renvoie pas de résultat exploitable ; le
  `if ("error" in res)` de `pricing-grid.tsx:50` reçoit alors un `res` non conforme, l'exception part dans le `catch`
  et l'utilisateur voit « Une erreur est survenue. Veuillez réessayer. » en même temps qu'il est navigué vers
  `/connexion`. Désagréable, pas dangereux — et **inchangé** par le plan.
- L'ancien code ne protégeait pas mieux : `authClient.useSession()` ne détecte pas une session invalidée côté serveur
  avant son prochain refetch. Il n'y a donc **pas** de régression sur ce scénario-ci.

**En revanche le scénario inverse régresse**, et il est plus fréquent : la session qui *apparaît* pendant que la page est
ouverte (connexion dans un autre onglet, refetch au focus). Voir constat #4.

### Q5 — `MobileMenu` reçoit `currentUser` non gardé

**Le plan a raison, prouvé.** `components/marketing-header/mobile-menu.tsx:145` :
`{isAuthenticated && currentUser ? (…) : (…)}`. C'est le **seul** endroit du fichier qui lit `currentUser` : les trois
usages (`currentUser.name` l.152/161, `currentUser.image` l.153, `currentUser.email` l.164) sont tous à l'intérieur de
cette branche. Aucun chemin n'affiche de donnée utilisateur avec `isAuthenticated === false`. Passer
`isAuthenticated={showUser}` en laissant `currentUser` descendre est sûr, et `mobile-menu.tsx` n'a effectivement pas
besoin d'être modifié.

### Q6 — Le test de couverture est-il honnête ?

**Deux réponses distinctes.**

- **La ligne `getServerSnapshot` est bien atteinte.** `renderToString` (React 19) exige le 3ᵉ argument de
  `useSyncExternalStore` et l'**appelle** ; la flèche `getServerSnapshot = () => false` de `hooks/use-mounted.ts` est
  donc réellement exécutée, et v8 la comptera couverte. Le test de la tâche 2 est honnête. Résolution non bloquante :
  `react-dom/server` expose `renderToString` par la condition `node` comme par `browser`
  (`node_modules/react-dom/server.browser.js`), le projet happy-dom résoudra dans les deux cas.
- **Mais la couverture ne mesure pas le correctif.** Voir constat #5 : `app/**` est absent de `coverage.include`
  (`vitest.config.ts:39-45`), donc `pricing-grid.tsx` n'est pas plus mesuré que
  `components/marketing-header/**`. Sur trois fichiers de production touchés, **zéro** n'est mesuré ; seul le hook de
  trois lignes entre dans la métrique. Le seuil restera vert sans rien prouver du correctif. Les tests
  `PricingGrid` gardent leur valeur — elle est simplement invisible au tableau de bord, et le plan devrait l'écrire au
  lieu de laisser croire que « ces fichiers sont déjà couverts ».

---

## 6. Verdict

> **Ce plan est-il sûr et complet à implémenter tel quel ? → NON.**

Il est **sûr** (aucune édition ne casse un consommateur, ne touche une frontière d'accès ni ne bascule une page ISR en
dynamique) et remarquablement précis dans ses ancres — je n'ai trouvé **aucune** édition qui ne s'appliquerait pas. Mais
il n'est pas **correct sur le fond** : la cause qu'il prétend corriger ne peut pas se produire avec la version de
Better Auth installée, et sa tâche centrale (la garde du header) est un no-op démontrable. L'implémenter en l'état
livrerait une quatrième tentative infructueuse sur `NOMAQBANQ-5`, avec la conviction fausse d'avoir prouvé la cause dans
la source de la bibliothèque.

**Points bloquants** : constat #1 (diagnostic irréalisable) et constat #2 (preuve décisive non consultée). Ils se
règlent tous les deux en ouvrant le diff serveur/client de `NOMAQBANQ-1E` avant de coder.

### Correctifs priorisés

| Quand                             | Constat | Action                                                                                                                            |
| --------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Avant de coder (bloquant)**     | #2      | Lire le diff serveur/client et la pile de composants de `NOMAQBANQ-1E`. C'est ce qui décide de tout le reste.                       |
| **Avant de coder (bloquant)**     | #1      | Rectifier la spec : le store est vide à l'hydratation, le mécanisme décrit est inatteignable. Retirer ou requalifier la tâche 4.     |
| **Avant de coder**                | #3      | Instruire l'hypothèse `Intl.NumberFormat` — la plus compatible avec les signatures Sentry observées.                                |
| **Avant de coder**                | #4      | Décider : prop serveur comme valeur initiale relevée par le client, ou régression assumée et écrite. Ne pas la laisser implicite.   |
| **Pendant l'implémentation**      | #6      | Intervertir les deux imports de la tâche 4 (`use-mounted` avant `useCurrentUser`).                                                  |
| **Pendant l'implémentation**      | #7      | Retirer le `--` des six commandes `bun run test -- …`.                                                                             |
| **Pendant l'implémentation**      | #5      | Corriger la phrase de Task 6 Step 2 : aucun composant modifié n'est mesuré.                                                        |
| **Opportuniste (même fonction)**  | #8      | Passer `createStripeCheckout` par `callAction`.                                                                                    |
| **Cosmétique**                    | #9      | Retirer ou remplacer `not.toContain("Awa Diallo")`.                                                                                |

**Ce que je garderais du plan, quoi qu'il arrive** : la tâche 1. Descendre `isAuthenticated` du Server Component
supprime un vrai clic mort (`pricing-grid.tsx:36`) et le saut visuel du bandeau après hydratation, et l'argument de la
spec contre la dérivation `accessStatus !== null` est juste. Elle mérite simplement un autre motif de commit que
« corrige l'erreur d'hydratation ».

---

## 7. Confirmations de sécurité opérationnelle

- **Lecture seule** : le seul fichier écrit est ce rapport. Aucun fichier source, spec, plan ou règle modifié —
  `git status` reste propre hors ce rapport non suivi.
- **Aucun commit, aucun push, aucune branche créée ou supprimée.**
- **Base de données** : aucune commande Neon, aucun outil MCP Neon appelé, aucune branche créée ou détruite. Les tests
  d'intégration (qui provisionnent une branche Neon) n'ont **pas** été lancés.
- **Secrets** : aucun `.env*` lu ni affiché. Aucun secret dans ce rapport.
- **Serveurs** : aucun serveur de dev lancé, ni au premier plan ni en arrière-plan. `bun dev` n'a jamais été invoqué.
- **Sentry** : aucune mutation (`resolve` / `archive` / commentaire). Les issues sont citées d'après la spec ; je n'ai
  pas non plus lu l'API Sentry dans cette session.
- **Commandes exécutées** : `bun run check` (gate demandé, exit 0), `git log`/`git status` (lecture),
  `bunx prettier --stdin-filepath` (aucune écriture), `bunx vitest list` (énumération, aucun test exécuté),
  `node -e` pour inspecter `Intl` et les métadonnées de paquets, plus des lectures/greps de fichiers.
