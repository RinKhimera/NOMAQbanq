# Revue adversariale — port Stripe + `fulfilStripeEvent` (#202, ferme #183 #184)

## 1. En-tête

- **Date** : 2026-09-19
- **Périmètre** : `git diff main...HEAD` sur `refactor/stripe-port-fulfillment`
  (6 commits `f1a43ee` → `aa9c45c`, 21 fichiers, +1672/−910). Spec : issue #202.
- **Méthode** : lecture seule, hostile ; chaque constat cite `fichier:ligne` et
  a été confronté à une tentative de réfutation (section 4). Parité vérifiée
  contre `git show main:…` des cinq fichiers de référence, y compris par
  extraction mécanique des littéraux (libellés `new Error("…")`, chaînes
  `detail`, `case "…"`, statuts) : **24 littéraux, 0 différence** entre l'ancien
  `switch` de la route et `features/payments/fulfillment.ts`.
- **Gates** :
  | Commande | Code |
  |---|---|
  | `bun run check` (prettier + tsc + eslint) | **0** |
  | `bun run test` (147 fichiers, 1650 tests) | **0** |
  | `bun run test:integration -- payments-fulfillment payments-checkout payments-refund payments-stripe` (branche Neon éphémère `test-1789835844151-xej5hi`, créée puis supprimée ; 4 fichiers, 47 tests) | **0** |

## 2. Tableau des constats

| # | Sév | fichier:ligne | Problème | Régression ? |
|---|---|---|---|---|
| 1 | 🟡 | `lib/stripe.ts:34-38`, `:43-46`, `:8-13` ; `tests/features/payments-cron.test.ts` (test « borne la requête » supprimé), `tests/features/payments-catalog.test.ts` (test « requête bornée » supprimé), `tests/features/payments-actions-errors.test.ts:49` | Trois invariants du port n'ont plus AUCUNE preuve exécutable : (a) `{ timeout: 8000, maxNetworkRetries: 1 }` à la construction, (b) `active: true` / `limit: 100` sur `prices.list`, (c) `resource_missing → null` (duck-check) et (d) le `name` de l'erreur de configuration. `lib/stripe.ts` est exclu de la couverture et n'a aucun test ; le test de la route fabrique le `name` à la main (`stripe-webhook-route.test.ts:63-66`). | NON (comportement) — perte de preuve |
| 2 | 🟡 | `features/payments/actions.ts:402-429` + `lib/stripe.ts:29-33` | Clé `STRIPE_SECRET_KEY` absente au checkout : `sdk()` lève d'abord DANS `resolveStripePrice` → capturée avec le diagnostic **faux** « résolution de la lookup_key impossible — repli sur stripe_price_id », puis re-lève dans `createCheckoutSession` → capture générique. Avant : une seule capture générique. Aucune vente n'aboutit (le port est l'unique chemin), mais Sentry reçoit deux issues dont une qui ment. | NON (fonctionnel) — dérive d'observabilité |
| 3 | ℹ️ | `tests/helpers/fake-stripe.ts:64-72` | `stripeBox.reset()` ne purge pas la file `mockResolvedValueOnce` des verbes. Vitest 4 : `restoreMocks` ne touche plus les `vi.fn()` (`@vitest/spy/dist/index.js:466-471`, registre `MOCK_RESTORE` = spies seulement) et `mockClear` ne vide pas `onceMockImplementations` (`:142-150`). Un `Once` non consommé fuit dans le test suivant. Aujourd'hui, les 18 `Once` posés sur des verbes ou des mocks db sont tous consommés (vérifié un à un) → aucun faux vert actuel. | NON |
| 4 | ℹ️ | `tests/integration/payments-fulfillment.test.ts:421-424` | « litige perdu rejoué → skipped » : `expect(await txRow(tx.id)).toEqual(row)` passerait aussi si le second appel **réécrivait** la ligne à l'identique (même `event.created`, même statut). La preuve réelle du rejeu tient sur `alerts[1]` (« déjà refunded », `:431-434`), qui ne peut venir que d'un UPDATE gardé à 0 ligne (`features/payments/stripe.ts:395-418`). | NON |
| 5 | ℹ️ | `tests/integration/payments-fulfillment.test.ts:59-76`, `:239-241` | `now` n'est pas figé (la spec disait « now fixe via les fixtures ») : `fulfilStripeEvent` n'a pas de paramètre d'horloge (port Clock hors périmètre), donc c'était irréalisable. L'assertion `expiresAt === completedAt + 90 j` n'est PAS tautologique (deux colonnes de deux tables, écrites par `completeStripeTransaction` et `applyGrant`), mais elle ne distingue le `now` du fulfillment de l'`accessExpiresAt` provisoire du pending qu'à quelques millisecondes près. | NON |
| 6 | ℹ️ | `aa9c45c` (`CONTEXT.md:106-116`) | Commit « Clôture / Score de clôture » (vocabulaire de passation) embarqué dans une PR de paiements : hors périmètre #202, aucune branche ne le porte ailleurs. | NON |
| 7 | ℹ️ | `lib/stripe.ts:8-13`, `app/api/stripe/webhook/route.ts:37` | L'erreur « configuration » capturée dans Sentry aura désormais pour titre `StripeConfigurationError: Configuration Stripe manquante (…)` au lieu de `Error: …` → nouvelle empreinte d'issue. Sans conséquence (n'arrive qu'en déploiement cassé). | NON |
| 8 | ℹ️ | `features/payments/actions.ts:41-44` et `lib/stripe.ts:43-46` | Le duck-check `code === "resource_missing"` existe maintenant en deux copies identiques (prévu par la spec : « hors périmètre : déplacement d'`isStripeResourceMissing` »), à maintenir en parallèle. | NON |

Aucun constat 🔴 ni 🟠. Toutes les branches du fulfillment sont un port
fidèle (section 4, F1).

## 3. Détail par constat

### #1 — 🟡 Le port `lib/stripe.ts` n'a plus aucune preuve exécutable

**Code** : `lib/stripe.ts:34-38` (options du client), `:94-98` (`active: true, limit: 100`), `:43-46` + `:137-139` (duck-check), `:8-13` (classe privée à `name`).

**Pourquoi c'est un vrai trou** : avant le lot, `tests/features/payments-cron.test.ts` (main, l. 151-169) et `tests/features/payments-catalog.test.ts` (main, « requête bornée ») affirmaient `toHaveBeenCalledWith(…, { timeout: 8000, maxNetworkRetries: 1 })` et `active: true` ; `tests/features/payments-actions-errors.test.ts` (main, l. 20-31) prouvait « `code: "resource_missing"` → pas de capture » avec une fixture en forme de `StripeError`. Après le lot, ces trois tests ont été supprimés ou remplacés par un test contre le **faux** (`payments-actions-errors.test.ts:49-56` : le faux rend `null` pour un id inconnu — le duck-check réel n'est plus jamais exécuté). Le test de configuration de la route (`stripe-webhook-route.test.ts:63-66`) fabrique `{ name: "StripeConfigurationError" }` à la main : il prouve le `if` de la route, pas que la classe de `lib/stripe.ts` produit ce `name`. Une régression future de n'importe lequel de ces quatre points (un `timeout` retiré « pour tester », un `active: true` oublié, un `code` lu au mauvais niveau, un `name` perdu par refactor) passerait tous les gates.

**Régression ?** NON sur le comportement (vérifié : voir Q1, Q4, Q8) — mais l'invariant user story 5 et 13 de la spec (« borne écrite une fois, au port ») n'est plus prouvé que par lecture.

**Comment je l'ai prouvé** : `git show main:tests/features/payments-cron.test.ts | grep -n borne -A20` ; `diff` des titres `it(` main vs HEAD (section 4) ; `grep -rn "lib/stripe\"" tests/` → 9 fichiers, tous via le faux, aucun test du module réel ; `vitest.config.ts` : `"lib/stripe.ts"` dans `coverage.exclude`.

**Correctif suggéré** (une seule suite, sans SDK réel, ~40 lignes) —
`tests/features/stripe-port.test.ts` :
```ts
const { StripeCtor, sdk } = vi.hoisted(() => {
  const sdk = { prices: { list: vi.fn() }, checkout: { sessions: { retrieve: vi.fn(), list: vi.fn(), create: vi.fn() } }, customers: { list: vi.fn() }, billingPortal: { sessions: { create: vi.fn() } }, webhooks: { constructEventAsync: vi.fn() } }
  return { sdk, StripeCtor: vi.fn(function () { return sdk }) }
})
vi.mock("stripe", () => ({ default: StripeCtor }))
vi.mock("@/lib/env/server", () => ({ env: mocks.env }))
```
puis quatre `it` : (a) `listActivePrices(["k"])` → `StripeCtor` appelé avec `{ apiVersion, timeout: 8000, maxNetworkRetries: 1 }` **et** `prices.list` avec `{ lookup_keys: ["k"], active: true, limit: 100 }` ; (b) `retrieve` rejette `Object.assign(new Error(), { code: "resource_missing" })` → `retrieveCheckoutSession` rend `null`, toute autre erreur remonte ; (c) `STRIPE_SECRET_KEY` absent → `verifyWebhook` rejette avec `name === "StripeConfigurationError"` et `instanceof Error` ; (d) secret webhook absent → idem. Cette suite règle à elle seule les questions 1, 4 et 8. Elle n'exige pas de retirer `lib/stripe.ts` de l'exclusion de couverture (la spec accepte « pas de test du SDK réel » ; ici on teste le port, pas le SDK).

### #2 — 🟡 Clé absente au checkout : première alerte au diagnostic faux

**Code** : `features/payments/actions.ts:402-429` (try/catch de résolution), `:425-428` (capture « résolution de la lookup_key … impossible — repli sur stripe_price_id »), `:457` (`createCheckoutSession` → `lib/stripe.ts:116` → `sdk()` `:29-33` lève à nouveau), `:536-539` (capture générique).

**Pourquoi c'est un vrai bug** : `sdk()` est paresseux et lève `StripeConfigurationError` au premier verbe appelé. Le premier verbe du checkout est `listActivePrices` (via `resolveStripePrice`), enveloppé dans un `catch` conçu pour les pannes de **lecture** (`prices:read` absent, 429). Une clé manquante y est donc classée « repli sur stripe_price_id » — un message qui affirme que la vente continue par le pointeur historique, alors qu'elle échoue trois lignes plus loin. Avant le lot, `getStripe()` était appelé en tête du `try` externe (main, `actions.ts` l. ~386) : une seule capture, générique, exacte.

**Régression ?** NON sur le fonctionnel : aucun chemin ne vend sans le SDK (le `INSERT` du pending est APRÈS `createCheckoutSession`, `:497`) — voir Q3. Régression d'observabilité mineure : deux issues Sentry au lieu d'une, la première trompeuse.

**Comment je l'ai prouvé** : lecture de `lib/stripe.ts:29-40` (mémo + throw) et de l'ordre des appels dans `createStripeCheckout` ; `git show main:features/payments/actions.ts | grep -n "getStripe()"`.

**Correctif suggéré** : dans le `catch` de `actions.ts:424`, re-lever une erreur de configuration avant de capturer :
`if (error instanceof Error && error.name === "StripeConfigurationError") throw error`. Le même prédicat existe déjà dans la route (`route.ts:10-11`) ; si on refuse de le dupliquer, l'alternative est d'accepter le double signalement et de le documenter dans le commentaire du `catch`.

### #3 — ℹ️ `stripeBox.reset()` ne remet pas les verbes à neuf

**Code** : `tests/helpers/fake-stripe.ts:64-72` ; `vitest.config.ts` (`clearMocks: true, restoreMocks: true`) ; `@vitest/spy/dist/index.js:142-161` et `:466-471`.

**Pourquoi** : en Vitest 4.1.11, `restoreAllMocks()` n'itère que `MOCK_RESTORE` (les `vi.spyOn`) — les `vi.fn()` du faux ne sont ni restaurés ni réinitialisés ; `clearMocks` → `mockClear()` vide `calls`/`invocationCallOrder` mais **pas** `config.onceMockImplementations`. Un `vi.mocked(fakeStripe.createCheckoutSession).mockResolvedValueOnce(…)` (`payments-actions.test.ts:431`) posé puis non consommé (test qui échoue avant l'appel, ou `it.skip` futur) s'appliquerait au test suivant.

**Régression ?** NON. Aucun faux vert actuel : j'ai vérifié que chaque `Once` (route : 2 ; fulfillment : 16 ; actions : 1) est consommé par son propre test.

**Correctif suggéré** : dans `reset()`, `for (const f of Object.values(fakeStripe)) f.mockReset()` — `vi.fn(impl).mockReset()` **restaure `impl`** (`fn()` pose `resetToMockImplementation: true`, `index.js:179-188`), donc le faux ne meurt pas. Même remarque pour `fake-mailer.ts` si elle s'applique.

### #4 — ℹ️ Rejeu « litige perdu » : l'assertion d'état est non discriminante

**Code** : `tests/integration/payments-fulfillment.test.ts:403-435`.

**Pourquoi** : le rejeu utilise le même événement (`created: 1_800_000_500`), donc une réécriture `status = refunded, refunded_at = <même date>` laisserait `txRow` égal. Ce que le test prouve VRAIMENT, c'est `alerts[1][1]` contenant « déjà refunded », qui n'est produit que si l'`UPDATE … WHERE status = 'completed'` a touché 0 ligne (`features/payments/stripe.ts:395-418` — `skipped` n'est jamais rendu autrement). La preuve est donc correcte, mais portée par l'alerte, pas par l'état.

**Correctif suggéré** : rejouer avec `created: 1_800_000_999` et affirmer `refundedAt` toujours égal à `1_800_000_500 * 1000` — l'état devient à son tour discriminant, indépendamment du libellé de l'alerte.

### #5 — ℹ️ `now` non figé (déviation de spec, assumée)

**Code** : `tests/integration/payments-fulfillment.test.ts:72-73` (`Date.now()`), `:239-241`.

La spec demandait « `now` fixe via les fixtures » ; `fulfilStripeEvent(event)` n'expose pas d'horloge (port Clock explicitement hors périmètre), donc l'auteur a relu `completedAt`. Pas tautologique (voir tableau). Écart de spec à consigner dans la PR, pas à corriger ici.

### #6 à #8 — ℹ️

Voir le tableau. #6 : à sortir de la PR ou à nommer dans son corps. #7 et #8 : aucune action requise.

## 4. Faux positifs écartés

| Soupçon | Écarté par |
|---|---|
| **F1 — Dérive d'un libellé, d'un `detail`, d'un statut ou d'une branche entre l'ancien `switch` et `fulfillment.ts`** | Extraction mécanique `grep -oE 'new Error\("…"\)\|detail: …\|case "…"\|"[a-z_]+"\]'` sur `main:route.ts` vs `fulfillment.ts` : 24 littéraux, `diff` vide ; idem pour les gabarits `const detail = \`…\`` (litige, remboursement, EFW). Ordre alerte/écriture relu branche par branche : `created` (`fulfillment.ts:171-176` puis `:194`), `closed` (`:177-184` puis `:194`, `:236`), `funds_reinstated` (`:185-191` puis `:194`), `refunded` complet (`:278-282` puis `:283`), `not_found` checkout (alerte APRÈS écriture, `:143-151`, comme avant `main:route.ts:184-192`). `event.created → refundedAt` aux deux endroits (`:238`, `:285`). |
| **F2 — Un retry de `checkout.sessions.create` (8 s puis nouvelle tentative) crée une session Stripe en double** | `stripe/cjs/RequestSender.js:242-256` : `_defaultIdempotencyKey` pose une `Idempotency-Key` sur **tout POST v1**, même à `maxNetworkRetries: 0` ; la nouvelle tentative rejoue la même clé → même session. Idem pour `billingPortal.sessions.create`. |
| **F3 — La borne 8 s s'applique à `constructEventAsync` et pourrait faire échouer une vérification de signature** | `timeout`/`maxNetworkRetries` sont des options de transport HTTP ; `constructEventAsync` n'émet aucune requête. Aucun effet. |
| **F4 — Un cas du fichier `stripe-webhook-errors.test.ts` a été perdu dans la migration** | `diff` des titres `it(` : 35 anciens = 33 migrés dans `stripe-fulfillment.test.ts` (+2 jumeaux « alerte AVANT écriture » : `:337`, `:821` ; le troisième, remboursement complet, préexistait `:657`) + « signature absente », « signature invalide », « échec de fulfillment → 500 » déplacés dans `stripe-webhook-route.test.ts:44-103`. Pour les cinq autres fichiers migrés, `diff` des titres : seuls les deux tests « bornée » ont disparu (→ constat #1) et un titre a été reformulé. |
| **F5 — `restoreMocks: true` rend le faux « mort » après le premier `mockResolvedValueOnce`** (Q5) | Vitest 4 : `restoreAllMocks` ne touche pas les `vi.fn()` (`@vitest/spy:466-471`) ; et même `mockReset` restaurerait `impl` (`resetToMockImplementation: true`, `:179-188`). Le faux survit. Le risque réel est l'inverse (constat #3). |
| **F6 — `calls` enregistré AVANT `failNext` fait passer une assertion `toEqual([...])` pour la mauvaise raison** (Q6) | Les quatre assertions sur `stripeBox.calls` (`route.test.ts:47`, `:82` ; `payments-cron.test.ts:108` ; `payments-fulfillment.test.ts:346`) sont toutes dans des tests sans `failNext`. Aucun test ne combine les deux. |
| **F7 — Un `payment_intent` OBJET peut arriver sur `checkout.session.completed` et changer `stripePaymentIntentId` (`""` → id)** (Q2) | Les événements webhook ne portent jamais d'objet étendu (`data.object` non expandé, doc Stripe « Expanding objects » : pas d'expansion dans les webhooks) ; un renvoi Dashboard ou `stripe trigger` non plus. Et si cela arrivait, l'id vaut mieux que `""` (un `""` rendrait le litige/remboursement ultérieur introuvable par `stripe_payment_intent_id`). Amélioration latente, pas régression. |
| **F8 — Le `name` de la classe privée ne survit pas à `Error` (cible TS ES2017)** (Q1) | `tsconfig.json:3` `target: ES2017`, `useDefineForClassFields` absent → émission `this.name = "…"` APRÈS `super()` ; avec champs natifs (Bun, Node ≥ 22 ou `useDefineForClassFields`) → `defineProperty` après `super()`. Probe exécutée sous les deux formes (Bun natif ; `tsc --target ES2017` puis Node 24) : `instanceof Error === true`, `name === "StripeConfigurationError"`, descripteur propre, `String(e)` préfixé. Le `name` est un littéral, insensible à la minification. |
| **F9 — Un chemin rend une erreur de configuration en 400** (Q1) | `verifyWebhook` (`lib/stripe.ts:68-81`) ne lève que `StripeConfigurationError` (clé, puis secret) ou l'erreur de `constructEventAsync` ; `route.ts:36-43` teste `instanceof Error && name` avant le 400. Une `StripeSignatureVerificationError` a `name = "StripeSignatureVerificationError"`. Pas de chemin. |
| **F10 — Le duck-check `resource_missing` rate parce que `code` est enfoui** (Q4) | `stripe/cjs/Error.js:75-96` : `this.code = raw.code` dans le constructeur de la base `StripeError`, hérité par `StripeInvalidRequestError` (`:128-131`). Premier niveau. Même prédicat que celui, éprouvé en prod, resté dans `actions.ts:41-44`. |
| **F11 — Un `deferred` qui lève APRÈS le 200 disparaît sans trace** | `sendConfirmation` a son `try/catch` → `captureServerError` (`fulfillment.ts:53-73`) ; `sendAbandonedCartReminder` capture en interne (`abandoned-cart.ts:92-93`) ; et Next `after` logge toute rejection résiduelle (`next/dist/server/after/after-context.js:153`). Identique à l'ancien `after(() => …)`. |
| **F12 — `resolveStripePrice` passe de `limit: 2` à `limit: 100`, changeant le comportement** | Seul effet : le `count` de l'alerte « plusieurs prix actifs » devient exact au lieu de plafonner à 2. Prévu par la spec (« garde sa logique d'ambiguïté sur `length > 1` »). |
| **F13 — Un import `stripe` hors du port sur un chemin de production** | `grep -rn 'from "stripe"'` : `lib/stripe.ts` (valeur), `route.ts`/`fulfillment.ts`/`stripe-api-version.ts` (`import type`), trois `scripts/*.ts` (CLI, hors app). Aucun `getStripe`/`getStripeWebhookSecret`/`waitUntil` restant hors d'un commentaire et de `CONTEXT.md` (_Avoid_). |
| **F14 — `StripePort = typeof import("@/lib/stripe")` inclut les types exportés et fausse `keyof`** | `typeof` d'un namespace ne porte que les valeurs ; `fake-stripe.test.ts:8-16` liste exactement 7 clés. |
| **F15 — `event.created` absent d'une fixture produit un `Invalid Date` silencieux** | Seules les fixtures `charge.dispute.closed` et `charge.refunded` en ont besoin ; toutes le posent (`stripe-fulfillment.test.ts:633`, `:783` ; `payments-fulfillment.test.ts:158`, `:178`). Stripe l'envoie toujours ; comportement identique à avant. |
| **F16 — Ordre `request.text()` / vérification de config inversé par rapport à main** | main lisait la config AVANT le corps ; HEAD lit le corps puis `verifyWebhook` (`route.ts:30-34`). Inobservable : aucun effet de bord entre les deux. |

## 5. Réponses aux questions ouvertes

1. **`name === "StripeConfigurationError"`** — **Oui, robuste.** Preuve F8 (émission ES2017 et champs natifs, exécutées). Aucun chemin vers un 400 (F9). Réserve : ce n'est prouvé que par ma probe, pas par la suite — c'est le point (c) du constat #1. Le prédicat `instanceof Error && name === …` est le bon choix sous la contrainte « sept verbes seulement » ; un `Symbol` ou un `brand` n'apporterait rien de plus qu'un `name` littéral.
2. **`paymentIntentIdOf` unique** — **Inobservable, et si observable, amélioration** (F7). D'accord avec l'auteur.
3. **Clé absente au checkout** — **Acceptable côté ventes** (aucune ne passe : `createCheckoutSession` lève avant l'`INSERT`, `actions.ts:457` vs `:497`), **mais pas côté alertes** : la première capture ment (« repli sur stripe_price_id »). Constat #2, correctif d'une ligne.
4. **`retrieveCheckoutSession` → `null`** — **`code` est au premier niveau** (F10), le duck-check est correct. Le trou est l'absence de test du port (constat #1, point b/c) : chaque `session_id` périmé ne deviendra PAS une capture, mais rien ne le garantit à la prochaine montée de `stripe-node`. La suite proposée en #1 le verrouille sans SDK réel.
5. **Faux Stripe et `restoreMocks`** — **Le faux survit** (F5) : en Vitest 4 `restoreAllMocks` ignore les `vi.fn()`, et `mockReset` restaurerait de toute façon l'implémentation d'origine. L'inquiétude réelle est symétrique : un `Once` non consommé **persiste** (constat #3). Pas de faux vert aujourd'hui.
6. **`calls` avant `failNext`** — **Voulu et sans victime** (F6). Aucune assertion sur `calls` dans un test qui pose `failNext`.
7. **Suite d'intégration** — `now` non figé : déviation inévitable sans port Clock, assertions non tautologiques (constat #5). « Litige perdu rejoué » : **prouve bien le rejeu**, mais par l'alerte « déjà refunded » et non par l'état (`toEqual(row)` passerait sous réécriture à l'identique) — constat #4, correctif : `created` différent au rejeu.
8. **Test « borne la requête » supprimé** — **Ce n'est pas un trou à accepter.** La façon honnête existe et ne touche pas le SDK réel : mocker le module `stripe` par un constructeur espionné et affirmer les options de construction (constat #1, correctif). Elle couvre au passage `active: true`/`limit: 100` (perdus aussi, test catalog « requête bornée » supprimé), le duck-check et le `name`. Quatre invariants pour une suite de ~40 lignes.

## 6. Verdict

**Mergeable dans `main` et déployable sous paiements réels sans e2e au-delà d'un paiement test avec `stripe listen` : OUI.**

Aucun point bloquant : le fulfillment est un port fidèle prouvé mécaniquement
(F1), l'idempotence/octroi/retrait sont couverts sur vraie base (47 tests
d'intégration verts), les retries de POST sont déduplicés par clé
d'idempotence (F2), et les deux seules différences observables sont celles que
la spec assume. Le paiement test avec `stripe listen` reste utile pour une
raison que la suite ne couvre pas : le port réel (`lib/stripe.ts`) n'est
exécuté par aucun test (constat #1) — ce paiement test est aujourd'hui la
seule exécution de `verifyWebhook`, `createCheckoutSession` et
`retrieveCheckoutSession` réels avant la prod. Faire aussi un
`session_id` périmé sur la page de succès (vérifie `resource_missing → null`
en vrai).

| Priorité | Correctif | Constat |
|---|---|---|
| Bloquant maintenant | — | — |
| Avant merge | Suite `tests/features/stripe-port.test.ts` (constructeur `stripe` mocké : options, `active/limit`, `resource_missing → null`, `name` de config) | #1 |
| Avant merge | Re-lever `StripeConfigurationError` dans le `catch` de résolution (`actions.ts:424`) — ou documenter le double signalement | #2 |
| Avant merge | Sortir `aa9c45c` de la PR (ou le nommer dans son corps) | #6 |
| Finition | `mockReset()` des verbes dans `stripeBox.reset()` (et `mailbox.reset()` si même forme) | #3 |
| Finition | Rejeu « litige perdu » avec un `created` différent | #4 |
| Finition | Noter dans la PR l'écart « `now` non figé » et sa raison | #5 |

## 7. Confirmations de sécurité opérationnelle

- **Lecture seule** : aucun fichier source, test ou doc modifié ; `git status`
  propre avant l'écriture de ce rapport, qui est le seul fichier créé. Rien
  n'est commité ni poussé.
- **Neon** : une seule branche éphémère (`test-1789835844151-xej5hi`), créée et
  supprimée par `bun run test:integration` ; la branche de production
  `br-blue-moon-adhu1l69` n'a pas été touchée ni interrogée.
- **Stripe live** : aucun appel ; les tests n'exécutent que le faux.
- **Secrets** : `.env*` jamais lu ni imprimé ; les journaux de gates ont été
  filtrés (`grep -vi "password\|sk_\|whsec"`) avant lecture.
- **Serveur de dev** : non lancé. Aucune commande destructive, de déploiement
  ni `git push`.
- Fichiers temporaires (probe `name-probe.ts`, journaux) confinés au
  scratchpad de session, hors du dépôt.
