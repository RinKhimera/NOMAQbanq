# Revue antagoniste — Migration paiement Stripe (Convex → Drizzle/Neon)

- **Date** : 2026-06-24
- **Scope** : `git diff bd7b94b^..HEAD` (3 commits) sur la branche `migration/drizzle-neon`
  (jamais déployée). 17 fichiers. Cœur : `features/payments/stripe.ts`,
  `app/api/stripe/webhook/route.ts`, `features/payments/actions.ts`, `lib/stripe.ts`,
  `lib/env/schema.ts`, `features/payments/lib.ts`, `features/payments/dal.ts`.
- **Méthode** : lecture seule, posture hostile, **aucun appel à l'API Stripe**
  (checkout/webhook/portail jamais exécutés — `.env.local` peut contenir des clés live).
  Chaque finding est prouvé en lisant le code (`fichier:ligne`) ; chaque bug suspecté a
  fait l'objet d'une tentative de réfutation avant d'être gardé (voir §4).
- **Source de vérité parité** : implémentation Convex encore présente
  (`convex/stripe.ts`, `convex/payments.ts`, `convex/http.ts`).
- **Gate** : `bun run check` (`tsc --noEmit && eslint --max-warnings 0`) → **exit 0**.

---

## 1. Synthèse

Le **chemin argent est solide**. Les durcissements revendiqués par le port **tiennent
tous** et n'introduisent pas de régression money-path :

- ✅ **Pas de double-crédit** : idempotence vérifiée sous verrou `user FOR UPDATE`
  + re-check `stripeEventId`/statut sous verrou + index unique `stripe_event_id` en
  filet + arithmétique d'accès à base de `max(...)` (idempotente même hors verrou).
- ✅ **Webhook non spoofable** : signature vérifiée sur le **corps brut**
  (`request.text()`), et le fulfillment exige une transaction `pending` réelle liée à la
  session → un événement signé pour une session inconnue ne crédite rien.
- ✅ **Aucun accès accordé sans paiement** : le crédit vient EXCLUSIVEMENT du webhook,
  gardé par `payment_status === "paid"` ; la page de succès est purement informationnelle ;
  `verify` ne crédite pas.
- ✅ **Anti-IDOR** sur `verify` (`metadata.userId === session.user.id`), **anti-open-redirect**
  sur success/cancel/return (`safePath` + base ancrée sur l'origine).
- ✅ **Cumul/combo corrects** (cumul non-combo, `now+durée` combo, `max(existant, …)`),
  conformes à la logique Convex.

Aucun finding 🔴. Les findings restants sont des **durcissements défensifs**, des
**limitations héritées de Convex (NON régressions)**, et une **régression UX** (perte de
réactivité, attendue par la migration). Rien ne bloque la Phase 7 ni la prod, sous réserve
des items « avant prod » (§5).

---

## 2. Tableau des findings (trié par sévérité)

| #  | Sév | fichier:ligne | problème | régression ? |
|----|-----|---------------|----------|--------------|
| 1 | 🟡 | `app/(dashboard)/dashboard/payment/_components/payment-success-client.tsx:40-44,242-291` | `accessStatus` figé au rendu serveur : la page peut afficher « Paiement réussi ! Votre accès a été activé instantanément » avec une section « Vos accès actifs » vide tant que le webhook n'a pas crédité ; « Vérifier à nouveau » ne rafraîchit pas l'accès. | OUI (perte réactivité Convex — intentionnel) |
| 2 | 🟡 | `features/payments/stripe.ts:157-184` | `failStripeTransaction` ne prend pas le verrou `user FOR UPDATE` et ne re-vérifie pas le statut sous verrou (asymétrie avec `completeStripeTransaction`). Théorique : un `expired` qui croise un `completed`. | OUI (technique, **non déclenchable** via Stripe) |
| 3 | 🟡 | `lib/env/schema.ts:39-40` + `app/api/stripe/webhook/route.ts:31-37` | `STRIPE_WEBHOOK_SECRET` optionnel : si absent en prod, le webhook répond 500 (fail-closed) → **tout fulfillment échoue silencieusement** (les utilisateurs paient, aucun accès) jusqu'à configuration. | NON (durcissement, mais footgun déploiement) |
| 4 | ℹ️ | `app/api/stripe/webhook/route.ts:54-98` | Remboursements / litiges (`charge.refunded`, `charge.dispute.created`) non gérés → l'accès **persiste** après un remboursement côté Stripe. | NON (parité Convex) |
| 5 | ℹ️ | `features/payments/actions.ts:345-362,449-461` | `customer_creation: "always"` crée un **nouveau** customer Stripe à chaque checkout ; le portail fait `customers.list({ email, limit: 1 })` → peut n'exposer qu'un seul customer (factures partielles) ; cassé si l'utilisateur change d'email. | NON (parité Convex) |
| 6 | ℹ️ | `app/(marketing)/tarifs/page.tsx:19-26` | La page marketing `/tarifs` devient **dynamique** (lit la session via `getAccessStatus`) → rendu non statique (impact cache/SEO mineur). | OUI (intentionnel) |
| 7 | ℹ️ | `app/api/stripe/webhook/route.ts` + `features/payments/actions.ts` | Aucun test sur le **route handler** (mapping 200/400/500, gating `payment_status`) ni sur checkout/verify/portal (appellent Stripe). Le DAL de fulfillment est, lui, bien couvert. | — (gap de couverture) |

---

## 3. Détail par finding

### 🟡 #1 — Page de succès : `accessStatus` figé, peut mentir sur l'accès actif
- **Code** : `app/(dashboard)/dashboard/payment/_components/payment-success-client.tsx:40-44`
  (`accessStatus` reçu en prop, capturé une fois au rendu serveur via
  `success/page.tsx:18-31`), `:83-84` (`state="success"` dès `payment_status === "paid"`),
  `:186-195` (copie « Votre accès a été activé instantanément »), `:242-291` (cartes
  d'accès rendues depuis le `accessStatus` figé).
- **Pourquoi c'est un vrai bug** : le crédit d'accès est asynchrone (webhook). Si la
  redirection succès précède le traitement du webhook (cas nominal de quelques
  centaines de ms à quelques secondes), `getAccessStatus()` côté serveur renvoie encore
  `examAccess/trainingAccess = null`. La page affiche alors « Paiement réussi ! … activé
  instantanément » **sans** la section « Vos accès actifs ». Le bouton « Vérifier à
  nouveau » (`:116-119`) ne fait que ré-exécuter `verify` (statut de paiement Stripe) ; il
  **ne re-fetch pas** `accessStatus`. L'utilisateur doit naviguer vers `/dashboard` pour
  voir l'accès. En Convex, la page utilisait une `useQuery` live qui se mettait à jour
  réactivement quand le webhook créditait — comportement perdu par la migration.
- **Régression ?** OUI, mais **attendue** : la suppression de la réactivité Convex est un
  parti pris documenté de la migration. Aucun impact money (l'accès EST bien accordé par
  le webhook ; seul l'affichage immédiat retarde).
- **Correctif suggéré** : sur « Vérifier à nouveau », faire `router.refresh()` (re-rend le
  Server Component → re-fetch `accessStatus`) ; et/ou adoucir la copie (« Paiement reçu —
  votre accès s'active dans quelques instants »). Optionnel : refetch l'accès via une
  Server Action quand `state` passe à `success`.

### 🟡 #2 — `failStripeTransaction` sans verrou ni re-check sous verrou (asymétrie)
- **Code** : `features/payments/stripe.ts:157-184`. Comparer à
  `completeStripeTransaction:64-83` qui prend `user FOR UPDATE` **puis** re-lit
  `stripeEventId` et le statut frais. `failStripeTransaction` lit `byEvent` puis `pending`
  (`:162-175`) **sans** verrou, et décide d'écrire `failed` sur la base d'un statut lu hors
  verrou.
- **Pourquoi (en théorie) c'est un bug** : sous READ COMMITTED, si un `expired` lit
  `status="pending"` puis qu'un `completed` concurrent commit (statut → `completed`,
  accès accordé), l'`UPDATE … SET status="failed"` de l'`expired` ré-évalue son `WHERE
  id=…` après acquisition du verrou de ligne et écrase `completed` → `failed`. L'accès
  `userAccess` n'est **pas** révoqué (ni `complete` ni `fail` ne suppriment `userAccess`),
  donc **aucune perte d'accès** ; seul le statut de la transaction devient incohérent.
- **Tentative de réfutation (concluante)** : Stripe **n'émet jamais** `checkout.session.expired`
  pour une session ayant atteint `complete` — le cycle de vie est `open → complete`
  *exclusif-ou* `open → expired` (après 24 h sans paiement). Les deux événements ne
  coexistent jamais pour une même session ⇒ la course est **non déclenchable** en
  pratique. (Deux `expired` concurrents du même event sont, eux, neutralisés par le
  re-check `byEvent` + l'idempotence de l'écriture.)
- **Régression ?** OUI au sens strict (l'OCC Convex aurait re-tenté la mutation et relu le
  statut), mais **inatteignable**. Au pire : incohérence cosmétique de statut, jamais une
  perte ni un sur-crédit d'accès.
- **Correctif suggéré** (défense en profondeur, optionnel) : dans `failStripeTransaction`,
  prendre `user FOR UPDATE` puis re-lire le statut sous verrou et ne jamais écraser un
  `completed` (la garde `pending.status === "completed"` existe déjà, mais hors verrou).

### 🟡 #3 — `STRIPE_WEBHOOK_SECRET` optionnel → fulfillment silencieusement HS si non configuré
- **Code** : `lib/env/schema.ts:39-40` (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`
  `z.string().optional()`), `lib/stripe.ts:28-33` (`getStripeWebhookSecret` lève si absent),
  `app/api/stripe/webhook/route.ts:31-37` (catch → 500).
- **Pourquoi c'est un vrai risque** : l'optionalité (légitime pour que l'app boote en dev
  sans Stripe) signifie qu'un déploiement prod avec `STRIPE_SECRET_KEY` présent mais
  `STRIPE_WEBHOOK_SECRET` absent **encaisse les paiements** (checkout fonctionne) tout en
  **échouant tout fulfillment** : le webhook renvoie 500, Stripe retente, aucun accès n'est
  accordé tant que le secret n'est pas posé. Comportement fail-closed (sûr du point de vue
  sécurité), mais footgun opérationnel coûteux (utilisateurs débités sans accès, support).
- **Régression ?** NON — c'est un durcissement par rapport au Convex `200-toujours` ; le
  risque est purement opérationnel.
- **Correctif suggéré** : ajouter `STRIPE_WEBHOOK_SECRET` + `STRIPE_SECRET_KEY` à une
  checklist de gate de déploiement prod (ou un check de démarrage qui exige les deux
  ensemble en `NODE_ENV=production`). Le commentaire `route.ts:20-21` documente déjà la
  config — le formaliser.

### ℹ️ #4 — Remboursements / litiges non gérés (accès persiste après refund Stripe)
- **Code** : `app/api/stripe/webhook/route.ts:54-98` ne gère que `checkout.session.completed`,
  `checkout.session.expired`, `payment_intent.payment_failed` (log seul). Pas de
  `charge.refunded` ni `charge.dispute.created`.
- **Pourquoi** : un remboursement ou un chargeback effectué côté Stripe ne révoque pas
  l'accès `userAccess` (seules les transactions **manuelles** peuvent être remboursées via
  l'admin, `actions.ts:197-202`). Un acheteur remboursé conserve son accès.
- **Régression ?** NON — `convex/http.ts:128-178` ne gérait pas non plus ces événements.
- **Correctif suggéré** (avant prod, produit) : décider la politique de révocation sur
  remboursement/litige et, si retenue, ajouter un handler qui mappe le `payment_intent`/
  `charge` → transaction → `revokeAccessIfLast`.

### ℹ️ #5 — Portail : un customer Stripe par checkout, lookup par email
- **Code** : `features/payments/actions.ts:349` (`customer_creation: "always"` sans
  réutilisation), `:450-456` (`customers.list({ email, limit: 1 })`).
- **Pourquoi** : chaque achat crée un nouveau customer ; `limit: 1` n'en récupère qu'un →
  le portail peut n'exposer qu'une partie des factures. Si l'utilisateur change d'email
  Better Auth, plus aucun customer ne matche (« Aucun historique »).
- **Régression ?** NON — `convex/stripe.ts:199-208` faisait exactement pareil.
- **Correctif suggéré** (polish) : persister un `stripeCustomerId` par utilisateur
  (créé/réutilisé au premier checkout) et ouvrir le portail dessus, plutôt qu'un lookup par
  email.

### ℹ️ #6 — `/tarifs` devient dynamique
- **Code** : `app/(marketing)/tarifs/page.tsx:19-26` — `async` + `getAccessStatus()` lit la
  session (cookies) → rend la page dynamique.
- **Pourquoi** : perte du rendu statique de cette page marketing (impact cache CDN / TTFB
  mineur). `getAvailableProducts()` seul resterait statique ; c'est `getAccessStatus()` qui
  force le dynamique.
- **Régression ?** Intentionnel (afficher l'accès courant sur la grille). Aucun impact
  fonctionnel ; à surveiller côté perf/SEO si la page doit rester cacheable.

### ℹ️ #7 — Gaps de tests
- **Code** : `tests/integration/payments-stripe.test.ts` couvre bien le DAL de fulfillment
  (happy / idempotent même-event / idempotent autre-event / cumul / combo / not_found /
  expired / expired-après-completed). **Non couverts** : le route handler webhook
  (`payment_status` gating, mapping 200/400/500, parsing `payment_intent`), `verify`
  (IDOR), `createStripeCheckout` (insert pending), `createCustomerPortal`. Justifié par la
  contrainte « ne pas appeler Stripe », mais la logique pure du route handler pourrait être
  testée en mockant `getStripe()`.

---

## 4. Faux positifs écartés (suspectés → disculpés, avec preuve)

1. **Double-crédit sur livraisons concurrentes du même event** — *disculpé*.
   `stripe.ts:64-68` prend `user FOR UPDATE` ; la 2ᵉ livraison bloque jusqu'au commit de la
   1ʳᵉ, puis ses re-lectures `byEvent` (`:71-76`) et statut frais (`:78-83`) voient l'event/
   le `completed` committés → `already_processed`. De plus l'arithmétique d'accès est en
   `max(...)` (`:124-129`), donc idempotente même hors verrou. Index unique
   `transactions_stripe_event_id_unique` (`db/schema/payments.ts:92`) en filet. Test
   `payments-stripe.test.ts:154-176` confirme.

2. **Cumul perdu (lost-update) sous concurrence** — *disculpé*. Deux sessions payées
   distinctes du même `user`/`accessType` sérialisent sur le verrou `user` ; la 2ᵉ relit
   l'expiration committée par la 1ʳᵉ et empile correctement (`+10j` → `+100j` → `+190j`).
   C'est précisément le durcissement requis par `.claude/rules/data-layer.md` (Postgres
   READ COMMITTED ne sérialise pas comme l'OCC Convex).

3. **Webhook spoofable** — *disculpé*. `route.ts:39-51` vérifie la signature sur le corps
   **brut** (`request.text()`, pas de body parser App Router) via
   `constructEventAsync`. Sans le secret, pas de signature valide ; et même un event signé
   pour une session inconnue → `completeStripeTransaction` renvoie `not_found` (aucun
   crédit). Le fulfillment crédite l'`userId` de la **transaction en base**, pas la metadata.

4. **Open-redirect via `successPath`/`cancelPath`/`returnPath`** — *disculpé*. `safePath`
   (`actions.ts:297-300`) exige `startsWith("/") && !startsWith("//")`, et le résultat est
   toujours préfixé par `appBase()` (`:302`, origine de `BETTER_AUTH_URL`). L'autorité est
   déjà consommée par `base` → tout chemin appended reste sur l'origine (même un `//x` y
   serait un simple chemin). De surcroît la cible de redirection est la propre session de
   l'utilisateur (pas un vecteur classique d'open-redirect ciblant des tiers).

5. **`not_found` répondu 200 → crédit perdu sur course webhook-avant-insert** — *disculpé*.
   `createStripeCheckout` insère le `pending` (`actions.ts:368-382`) **avant** de retourner
   `checkoutUrl` (`:384`) ; l'utilisateur ne peut atteindre Stripe Checkout (et donc payer)
   qu'après réception de l'URL → le `pending` est committé avant tout paiement possible. Si
   l'insert échoue, l'URL n'est jamais renvoyée → pas de paiement → pas d'event `completed`.
   `not_found` ne peut donc coïncider avec une session payée.

6. **`productCode` falsifié pour payer moins cher** — *disculpé*. `actions.ts:320-340`
   valide le code contre l'enum, charge le produit, et facture `product.stripePriceId` ; le
   montant et l'accès dérivent du **même** produit choisi. Pas de découplage prix/accès.

7. **`amount_total` non revérifié au webhook → sous-paiement** — *disculpé*. Le montant est
   fixé par le `stripePriceId` Stripe ; le client ne peut pas l'altérer.
   `allow_promotion_codes: true` (`:361`) est une réduction intentionnelle gérée par Stripe.
   L'accès accordé dépend de `durationDays` (snapshot DB), pas d'un montant client.

8. **Combo écrase un accès existant plus long** — *disculpé*. Combo calcule
   `txAccessExpiresAt = now+durée` (`stripe.ts:97-98`) mais l'octroi prend
   `finalExpiry = max(existant, txAccessExpiresAt)` (`:124-129`) → un accès déjà plus
   tardif est préservé. Parité avec `convex/payments.ts:1196-1202`.

9. **IDOR sur `verify`** — *disculpé* (durcissement qui tient). `actions.ts:418-420` refuse
   la session si `checkout.metadata?.userId !== session.user.id` ; metadata absente →
   `undefined !== id` → refus. Le `payment_status` réel conditionne le succès (`:423`,
   consommé par `payment-success-client.tsx:83-99`).

---

## 5. Verdict

**Est-il sûr de continuer la Phase 7 (crons/uploaders) ET de viser une mise en prod du
paiement ?** → **OUI.**

Le money-path est correct et durci : pas de double-crédit, pas de webhook spoofable, pas
d'accès accordé sans paiement vérifié, anti-IDOR et anti-open-redirect en place, cumul/combo
conformes à Convex. **Aucun bloquant 🔴.** Le gate `bun run check` passe (exit 0).

### Correctifs priorisés

| Priorité | Item | Finding |
|----------|------|---------|
| **Bloquant maintenant** | *(aucun)* | — |
| **Avant prod** | Garantir `STRIPE_WEBHOOK_SECRET` **et** `STRIPE_SECRET_KEY` présents en prod (checklist/gate de démarrage) — sinon paiements encaissés sans fulfillment | #3 |
| **Avant prod** | Décider la politique remboursement/litige : sans handler, l'accès persiste après un refund Stripe | #4 |
| **Avant prod (faible effort)** | Symétriser le verrou/re-check dans `failStripeTransaction` (défense en profondeur, même si la course est non déclenchable) | #2 |
| **Polish** | Page succès : `router.refresh()` au retry et/ou adoucir la copie d'activation | #1 |
| **Polish** | Portail : persister un `stripeCustomerId` par user au lieu de `customer_creation:"always"` + lookup email | #5 |
| **Polish** | Tests du route handler webhook (gating `payment_status`, 200/400/500) en mockant `getStripe()` | #7 |
| **Surveillance** | `/tarifs` désormais dynamique — vérifier l'impact cache/SEO | #6 |

---

## 6. Confirmations de sûreté opérationnelle

- ✅ **Prod Neon intouchée** : aucune écriture, aucune branche touchée ; la branche
  `production` (`br-blue-moon-adhu1l69`) n'a pas été approchée.
- ✅ **Aucun appel à l'API Stripe** : checkout / webhook / portail n'ont jamais été
  exécutés ; analyse 100 % statique (lecture du code). `bun run test:integration` (qui
  teste le fulfillment DB sans Stripe) **n'a pas** été lancé.
- ✅ **Secrets jamais imprimés** : aucune valeur `sk_`/`rk_`/`whsec_`, aucun contenu de
  `.env.local` n'a été affiché.
- ✅ **Lecture seule** : seules des commandes `git diff`/`git log`, des lectures de
  fichiers, des recherches, et la commande de gate `bun run check` ont été exécutées.
  Aucun fichier source modifié. (Ce rapport est écrit mais **non committé** — artefact
  jetable à supprimer après triage.)
