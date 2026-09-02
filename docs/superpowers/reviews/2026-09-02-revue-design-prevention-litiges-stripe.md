# Revue adversariale de design — Prévention des litiges Stripe

## 1. En-tête

**Date** : 2026-09-02
**Branche** : `feat/prevention-litiges-stripe` (`496042a`, 2 commits de docs au-dessus de `main`, arbre propre, aucun code applicatif)

**Périmètre**

- Spec : [2026-09-02-prevention-litiges-stripe-design.md](docs/superpowers/specs/2026-09-02-prevention-litiges-stripe-design.md) (228 l.)
- Plan : [2026-09-02-prevention-litiges-stripe.md](docs/superpowers/plans/2026-09-02-prevention-litiges-stripe.md) (2 333 l., 12 tâches)
- Code réel confronté : [db/schema/payments.ts](db/schema/payments.ts) · [features/payments/stripe.ts](features/payments/stripe.ts) · [features/payments/actions.ts](features/payments/actions.ts) · [features/payments/dal.ts](features/payments/dal.ts) · [app/api/stripe/webhook/route.ts](app/api/stripe/webhook/route.ts) · [components/shared/payments/transaction-table.tsx](components/shared/payments/transaction-table.tsx) · [email/index.tsx](email/index.tsx) · [email/send.ts](email/send.ts) · [email/templates/email-layout.tsx](email/templates/email-layout.tsx) · [lib/format.ts](lib/format.ts) · [lib/base-url.ts](lib/base-url.ts) · [lib/observability.ts](lib/observability.ts) · [lib/stripe-api-version.ts](lib/stripe-api-version.ts) · [scripts/audit-stripe-orphelins.ts](scripts/audit-stripe-orphelins.ts) · [scripts/test-integration.ts](scripts/test-integration.ts) · [db/schema/auth.ts](db/schema/auth.ts) · [db/schema/exams.ts](db/schema/exams.ts) · [db/schema/training.ts](db/schema/training.ts) · [db/index.ts](db/index.ts) · [features/users/cron.ts](features/users/cron.ts) · [vitest.config.ts](vitest.config.ts) · [vitest.coverage.config.ts](vitest.coverage.config.ts) · [.github/workflows/ci.yml](.github/workflows/ci.yml) · `tests/features/stripe-webhook-errors.test.ts` · `tests/features/payments-actions.test.ts` · `tests/integration/payments-stripe.test.ts` · `tests/integration/payments-admin-dal.test.ts` · `tests/email/*.test.ts` · `tests/components/payments/TransactionTable.test.tsx` · `node_modules/stripe@22.4.0` (types) · `.claude/rules/payments.md`

**Méthode** : lecture seule, posture hostile. Chaque constat porte une preuve `fichier:ligne` ou une commande rejouable. Chaque défaut suspecté a subi une tentative de réfutation ; ceux qui y ont survécu sont en §3, les autres en §4. Sources externes consultées : documentation Stripe (`docs.stripe.com/webhooks`, `docs.stripe.com/disputes/how-disputes-work`) et les déclarations de types du SDK installé.

**État du contrôle**

```
$ bun run check && bun run test
prettier --check .  → All matched files use Prettier code style!
tsc --noEmit        → OK
eslint --max-warnings 0 → OK
vitest run --project frontend → Test Files 119 passed (119) · Tests 1357 passed (1357) · 41.87 s
EXIT_CODE=0
```

**La base est verte avant le début de l'implémentation.** `bun run test:integration` n'a pas été lancé (crée une branche Neon), conformément à la consigne.

---

## 2. Tableau des constats

| # | Sév | fichier:ligne | problème | régression ? |
|---|-----|---------------|----------|--------------|
| 1 | 🔴 | plan `2026-09-02-…stripe.md:232-268` (impl. de `recordStripeDispute`) | Le garde-fou terminal est indexé sur le `payment_intent`, pas sur le litige. Un **second** litige sur le même paiement — cas documenté par Stripe — n'est jamais enregistré : le badge admin continue d'afficher l'issue du PREMIER pendant qu'un chargeback vivant court. | NON (feature neuve) — mais annule l'objectif de la feature |
| 2 | 🔴 | plan `:1444-1478` + [app/api/stripe/webhook/route.ts:165](app/api/stripe/webhook/route.ts#L165) | Le courriel part **dans** la requête webhook, avant le 200. Stripe exige l'inverse. Un dépassement de délai → retry → `already_processed` → **courriel perdu définitivement ET aucune trace Sentry** (la fonction est tuée avant le `catch`). | OUI — allonge la requête de fulfillment, dont le contrat 500/retry est porteur |
| 3 | 🟠 | plan `:1288-1300` vs [features/payments/stripe.ts:185-190](features/payments/stripe.ts#L185-L190) | `accessExpiresAt` renvoyé au courriel = expiration de la **transaction**, pas de l'accès réellement accordé (`max(existant, tx)`). Un combo par-dessus un accès plus long annonce au client une date **antérieure** à la vraie. Un combo octroie en plus DEUX accès que le champ unique ne peut pas exprimer. | NON |
| 4 | 🟠 | plan `:1022` et `:1025` | Deux assertions du test `tests/email/index.test.ts` **échouent telles quelles** : `toBe("200 $")` (espace ASCII vs `U+00A0` produit par `Intl` fr-CA) et `toContain("91")` (la sortie est `9 120 000 XAF`, sans `91` contigu). Le plan annonce « Expected: tous verts ». | NON |
| 5 | 🟠 | plan `:590-618` vs [app/api/stripe/webhook/route.ts:122-141](app/api/stripe/webhook/route.ts#L122-L141) | L'alerte « litige ouvert » devient **conditionnée à une écriture DB** placée avant elle. Panne Neon → l'alerte détaillée disparaît au profit du `catch` générique (`detail: event.type`) : plus d'id de litige, ni montant, ni motif, ni `payment_intent`. Et sur un `payment_intent` fantôme, le message change (`litige sans transaction correspondante`) → nouveau fingerprint Sentry, le signal « un litige vient de s'ouvrir » est perdu. | OUI |
| 6 | 🟠 | plan `:2015-2025` (script `dispute-evidence.ts`) | Le script lit `charge.payment_method_details?.card`. Pour un paiement **Link** (le cas qui a motivé l'issue), le SDK expose `payment_method_details.link` — objet distinct sans `three_d_secure` ni `checks`. Résultat : `cardCountry: "inconnu"`, `threeDSecure: "non tenté"` sur le dossier le plus important. | NON |
| 7 | 🟡 | plan `:229` (`TERMINAL_DISPUTE_STATUSES`) + spec `:88-91` | Le statut `prevented` existe dans `Dispute.Status` du SDK installé et est terminal ; il manque à la liste (et à l'énumération du spec). Un `under_review` en retard peut l'écraser. | NON |
| 8 | 🟡 | plan `:459-462` (`request_three_d_secure`) | Le paramètre est **card-only**. Un paiement Link traité comme type de moyen de paiement `link` n'est pas couvert — c'est-à-dire potentiellement le cas d'août. | NON |
| 9 | 🟡 | plan `:1289` (`userEmail`) vs [features/users/cron.ts:32-37](features/users/cron.ts#L32-L37) | Aucun garde-fou sur les comptes anonymisés (`email = deleted-<id>@deleted.invalid`). Un `async_payment_succeeded` tardif enverrait un courriel vers un domaine `.invalid` → hard bounce SES, réputation d'expédition. | NON |
| 10 | 🟡 | plan `:900-905` (gabarit) vs [email/send.ts:34-51](email/send.ts#L34-L51) | « Répondez à ce courriel » alors que `sendEmail` ne pose **aucun** `ReplyToAddresses` ; et le spec (`:120`) demande une « adresse de support » que le gabarit ne contient pas. | NON |
| 11 | 🟡 | plan `:2320-2322` + [vitest.config.ts:39-45](vitest.config.ts#L39-L45) | La vérification finale annonce « couverture ≥ 80 % sur les quatre axes » avec trois commandes qui **ne calculent aucune couverture**. Et `dispute-badge.ts` (`.ts`) échappe à l'`include` `components/**/*.tsx` pendant que `transaction-table.tsx` gagne une branche jamais rendue en test. | NON |
| 12 | 🟡 | plan `:1201-1235` | Le test « completed → retourne les données du courriel » réutilise `U_HAPPY` et crédite 90 j de plus. Placé ailleurs qu'en **fin** du `describe`, il casse `approxDays(acc.expiresAt, 90)` (`tests/integration/payments-stripe.test.ts:237`). Le plan ne dit pas où l'insérer. | NON |
| 13 | ℹ️ | plan `:847` | « Expected: erreurs là où `AdminTransactionView` est construit à la main » : **aucun** site de ce genre n'existe. `tsc` renverra 0 erreur ; l'agent risque de chercher un problème inexistant. | NON |
| 14 | ℹ️ | plan `:1400-1410` (imports `email/index.tsx`) | Les imports ajoutés doivent être insérés dans l'ordre Prettier (`@/` avant les relatifs, relatifs triés). Collés en bloc, `prettier --check` échoue. | NON |

---

## 3. Détail par constat

### 🔴 1 — Le garde-fou terminal ignore l'identité du litige

**Code.** Plan lignes 232-268 :

```ts
const TERMINAL_DISPUTE_STATUSES = ["won", "lost", "warning_closed"] as const
// …
.where(and(
  eq(transactions.stripePaymentIntentId, params.stripePaymentIntentId),
  incomingIsTerminal ? undefined : or(isNull(…), notInArray(transactions.disputeStatus, [...TERMINAL_DISPUTE_STATUSES])),
))
```

Le prédicat ne mentionne jamais `params.stripeDisputeId`. La clé de rattachement est le seul `stripe_payment_intent_id` ([db/schema/payments.ts:82](db/schema/payments.ts#L82)).

**Pourquoi c'est un vrai défaut.** La doc Stripe, section *Receive multiple disputes* : « In extremely rare cases, you might receive more than one dispute per payment. This can happen when a customer files a new dispute with a different reason code, for a new line item in the original transaction, on multi-capture payments or simply because the issuer acquired new information about the payment allowing them to refile a dispute. Handle each dispute the same way as any other dispute; each dispute requires you to either accept or counter the dispute. »

Déclencheur concret : litige `dp_A` se clôt en `won` (ou `lost`, ou `warning_closed`) → colonne `won`. Le client refile `dp_B`, `charge.dispute.created` arrive avec `status: "needs_response"`. `incomingIsTerminal` est faux, la ligne porte `won` → **0 ligne mise à jour**, retour `kept_terminal`. Ni `stripe_dispute_id` ni `dispute_status` ne bougent. Pendant les 7-21 jours de la fenêtre de réponse de `dp_B`, `/admin/transactions` affiche « Litige gagné » en vert. Les `charge.dispute.updated` suivants de `dp_B` sont eux aussi absorbés en silence — le route code n'alerte que sur `not_found`, jamais sur `kept_terminal` (plan `:600-608`).

C'est exactement le scénario que la feature existe pour rendre visible.

**Régression ?** NON (code neuf), mais le défaut annule la valeur du lot 1.

**Comment je l'ai prouvé.** Lecture du plan `:229` et `:243-256` ; `grep -n "stripe_payment_intent_id" db/schema/payments.ts` → une seule colonne, aucun index unique ; `WebFetch docs.stripe.com/disputes/how-disputes-work` → section « Receive multiple disputes » citée ci-dessus.

**Correctif suggéré.** Scoper le garde-fou au litige courant :

```ts
or(
  isNull(transactions.stripeDisputeId),
  ne(transactions.stripeDisputeId, params.stripeDisputeId),   // nouveau litige : on écrit
  isNull(transactions.disputeStatus),
  notInArray(transactions.disputeStatus, [...TERMINAL_DISPUTE_STATUSES]),
)
```

et alerter Sentry sur `kept_terminal` quand `stripeDisputeId` entrant ≠ stocké (le seul cas qui n'est pas une simple redélivrance). Ajouter un test jumeau : « un SECOND litige sur le même payment_intent remplace le premier, même clos ».

---

### 🔴 2 — Le courriel est envoyé avant le 200, contre la règle explicite de Stripe

**Code.** Plan `:1444-1478` : `sendConfirmation(result)` est **awaité** dans le `case "checkout.session.completed"`, donc à l'intérieur du `try` de [app/api/stripe/webhook/route.ts:60-163](app/api/stripe/webhook/route.ts#L60-L163), avant le `return new Response(null, { status: 200 })` de la ligne 165. `sendPurchaseConfirmationEmail` → `sendEmail` → **deux rendus React Email** (`render(react)` et `render(react, { plainText: true })`, [email/send.ts:29-32](email/send.ts#L29-L32)) puis un appel réseau SES v2.

**Pourquoi c'est un vrai défaut.** `docs.stripe.com/webhooks`, section *Quickly return a 2xx response* : « Your endpoint must quickly return a successful status code (2xx) before any complex logic that could cause a timeout. » Et la table de debug : « (Timed out) ERR — The destination server took too long to respond… Make sure you defer complex logic and return a successful response immediately in your webhook handling code. »

Le mode de défaillance est **asymétrique** et invisible :

1. SES lent (ou fonction froide + double rendu) → Stripe considère la livraison échouée.
2. Stripe rejoue l'événement (jusqu'à 3 jours, back-off exponentiel).
3. Le rejeu atteint `completeStripeTransaction`, trouve `stripe_event_id` déjà posé ou `status = "completed"` ([features/payments/stripe.ts:88-100](features/payments/stripe.ts#L88-L100)) → `already_processed` → **aucun courriel**, par conception du plan (`:1417-1424`).
4. Le `captureServerError` du `catch` de `sendConfirmation` n'a jamais tourné : la fonction a été tuée. **Zéro trace.**

Le résultat est le contraire de l'objectif : le client visé — celui qui n'a « aucune trace écrite de son achat » — reste sans courriel, en silence. S'ajoute que la latence SES entre dans le budget d'un endpoint dont le 500→retry est un invariant documenté ([.claude/rules/payments.md:32-38](.claude/rules/payments.md#L32-L38)).

**Régression ?** OUI — le contrat de réponse du webhook (le point que le spec promet de ne pas toucher) devient dépendant de la latence SES.

**Comment je l'ai prouvé.** Lecture du plan `:1444-1478` ; [email/send.ts:29-32](email/send.ts#L29-L32) (double `render`) ; `WebFetch docs.stripe.com/webhooks` (citations ci-dessus) ; [features/payments/stripe.ts:88-100](features/payments/stripe.ts#L88-L100) pour le chemin `already_processed`.

**Correctif suggéré.** `waitUntil` — `@vercel/functions` est **déjà** une dépendance runtime ([db/index.ts:1](db/index.ts#L1)) :

```ts
import { waitUntil } from "@vercel/functions"
// …
if (result.status === "completed") waitUntil(sendConfirmation(result))
```

Le 200 part immédiatement, l'envoi continue après la réponse, le `catch` interne garde sa capture Sentry. Adapter le test « fulfillment completed → courriel envoyé » (il faudra attendre la promesse, ou mocker `waitUntil` en `(p) => p`). Défense en profondeur complémentaire : rendre le courriel rattrapable — un `confirmation_email_sent_at` nul sur une transaction `completed` de plus de N minutes est déjà un critère de reprise exploitable par un cron ; le spec s'interdit la nouvelle tentative, mais rien n'oblige à s'interdire la **détectabilité**.

---

### 🟠 3 — La date de fin d'accès annoncée au client peut être fausse

**Code.** Plan `:1296` : `accessExpiresAt: txAccessExpiresAt`. Or l'accès réellement posé est ([features/payments/stripe.ts:183-190](features/payments/stripe.ts#L183-L190)) :

```ts
const finalExpiry = new Date(Math.max(existing?.expiresAt.getTime() ?? 0, txAccessExpiresAt.getTime()))
```

et pour un combo, `txAccessExpiresAt = now + durée` sans cumul ([features/payments/stripe.ts:114-115](features/payments/stripe.ts#L114-L115)).

**Pourquoi c'est un vrai défaut.** Déclencheur : un utilisateur a `user_access.exam` jusqu'au 31 décembre. Le 2 septembre il achète `premium_access` (combo, 30 j). `txAccessExpiresAt` = 2 octobre. `finalExpiry` pour `exam` = **31 décembre** (le `max`). Le courriel annonce « Accès valide jusqu'au 2 octobre 2026 » — trois mois avant la vérité. Deuxième problème structurel : un combo octroie `exam` ET `training`, dont les expirations peuvent différer ; un champ unique `accessExpiresAtLabel` ne peut pas les représenter.

Un document explicitement conçu comme pièce de dossier de litige ne peut pas porter une date d'accès inexacte : c'est le premier chiffre qu'un émetteur recoupera.

**Régression ?** NON.

**Comment je l'ai prouvé.** Lecture de [features/payments/stripe.ts:112-123](features/payments/stripe.ts#L112-L123) et `:180-211` ; le `Math.max` est indépendant de `txAccessExpiresAt`. Aucun test d'intégration existant ne couvre « combo + accès existant plus long » (`grep -n "U_COMBO" tests/integration/payments-stripe.test.ts`).

**Correctif suggéré.** Renvoyer les expirations **effectivement écrites**, une par type octroyé :

```ts
grantedAccess: Array<{ accessType: "exam" | "training"; expiresAt: Date }>
```

collecté dans la boucle `for (const accessType of types)` où `finalExpiry` est déjà calculé. Le gabarit affiche une ligne par accès. Ajouter le test jumeau (combo sur accès plus long).

---

### 🟠 4 — Deux assertions du plan échouent telles quelles

**Code.** Plan `:1022` `expect(props.amountLabel).toBe("200 $")` et `:1025` `expect(props.presentmentLabel).toContain("91")`.

**Pourquoi c'est un vrai défaut.** [lib/format.ts:49-54](lib/format.ts#L49-L54) et `:66-83` produisent des chaînes ICU dont l'espacement n'est pas ASCII.

**Comment je l'ai prouvé.** Rejouable :

```
$ node -e '…formatCurrency(20000,"CAD")…'
amountLabel = "200 $"
codepoints: 32 30 30 a0 24         ← U+00A0, pas U+0020
presentmentLabel = "9 120 000 XAF"
contains 91 ? false
```

Et le plan contient bien des espaces ASCII :

```
$ grep -n 'amountLabel).toBe' docs/…/plans/2026-09-02-prevention-litiges-stripe.md | cat -A
1022:    expect(props.amountLabel).toBe("200 $")$      ← aucun M-BM- : espace 0x20
```

**Régression ?** NON.

**Correctif suggéré.** `expect(props.amountLabel.replace(/ | /g, " ")).toBe("200 $")` et, pour le montant présenté, tester la valeur normalisée (`presentmentLabel.replace(/\s/g, "")` contient `9120000`) plutôt qu'un fragment de chaîne groupée. Le commentaire du plan sur les données ICU est juste ; l'assertion qui l'accompagne ne l'est pas.

---

### 🟠 5 — L'alerte « litige ouvert » devient tributaire de la base

**Code.** Aujourd'hui, [app/api/stripe/webhook/route.ts:122-141](app/api/stripe/webhook/route.ts#L122-L141) : `charge.dispute.created` ne touche jamais la base ; le `captureServerError` détaillé est inconditionnel. Le plan (`:590-618`) place `await recordStripeDispute(...)` **avant** l'alerte, et ajoute un `break` anticipé sur `not_found`.

**Pourquoi c'est un vrai défaut.** Deux déclencheurs distincts :

1. **Neon indisponible.** `recordStripeDispute` lève → l'exception remonte au `catch` de la ligne 157 → `captureServerError("[stripe:webhook]", error, { detail: event.type })`. Sentry reçoit « charge.dispute.created » et rien d'autre : plus d'`id` de litige, de montant, de motif ni de `payment_intent`. Le retry Stripe finira par passer, mais la première alerte — celle qui ouvre la fenêtre de réponse — est aveugle. Le plan a d'ailleurs un test qui verrouille ce comportement (`:462-479`, « échec DB sur un événement de litige → 500 »), sans mesurer qu'il dégrade l'alerte du `created`.
2. **`payment_intent` sans transaction.** Le `break` (`:604-607`) substitue le message « litige sans transaction correspondante » à « litige ouvert sur un paiement Stripe » : autre fingerprint Sentry, et le fait qu'un litige vient de s'ouvrir n'est plus énoncé.

**Régression ?** OUI — comportement d'alerte existant, modifié hors du périmètre annoncé par le spec.

**Comment je l'ai prouvé.** Diff de lecture entre [app/api/stripe/webhook/route.ts:119-141](app/api/stripe/webhook/route.ts#L119-L141) et le bloc de remplacement du plan `:576-643` ; [lib/observability.ts:15-27](lib/observability.ts#L15-L27) confirme que `detail` est le seul porteur de contexte.

**Correctif suggéré.** Émettre l'alerte de cycle de vie **avant** l'écriture, puis persister ; et sur `not_found`, ajouter l'alerte dédiée **sans** supprimer celle du `created` :

```ts
if (event.type === "charge.dispute.created") captureServerError(…, new Error("litige ouvert sur un paiement Stripe"), { detail })
if (disputedPaymentIntent) { const recorded = await recordStripeDispute(…); if (recorded.status === "not_found") captureServerError(…) }
if (event.type === "charge.dispute.closed") { … }
```

---

### 🟠 6 — Le script de preuves est aveugle au cas Link

**Code.** Plan `:2013-2026` :

```ts
const card = charge.payment_method_details?.card
cardCountry: card?.country ?? null,
threeDSecure: card?.three_d_secure ? `${…}` : "non tenté",
```

**Pourquoi c'est un vrai défaut.** Dans le SDK installé, `Charge.payment_method_details` porte `card?` **et** `link?` comme entrées distinctes, et `PaymentMethodDetails.Link` ne contient qu'un seul champ :

```
node_modules/stripe/cjs/resources/Charges.d.ts:337   card?: PaymentMethodDetails.Card;
node_modules/stripe/cjs/resources/Charges.d.ts:352   link?: PaymentMethodDetails.Link;
node_modules/stripe/cjs/resources/Charges.d.ts:1172  interface Link { country: string | null }
```

Le litige d'août est passé par Link. Si la charge est de forme `payment_method_details.link`, le script rend « Pays de la carte : inconnu · 3D Secure : non tenté » — deux lignes trompeuses pour un dossier de contestation, alors que le pays de financement est disponible dans `link.country`. (L'autre forme existe : Link comme *wallet* d'une carte, `payment_method_details.card.wallet.link`, `Charges.d.ts:1768` — là le code du plan marche. Le script doit gérer les deux.)

**Régression ?** NON.

**Comment je l'ai prouvé.** `grep -n "link?: PaymentMethodDetails.Link" node_modules/stripe/cjs/resources/Charges.d.ts` et lecture de l'interface `Link` ligne 1172.

**Correctif suggéré.**

```ts
const d = charge.payment_method_details
const card = d?.card
cardCountry: card?.country ?? d?.link?.country ?? null,
paymentMethodType: d?.type ?? "inconnu",   // à afficher : « Link », « card »…
threeDSecure: card?.three_d_secure ? … : d?.link ? "non applicable (Link)" : "non tenté",
```

et vérifier sur la vraie charge d'août laquelle des deux formes s'applique — cette vérification conditionne aussi le constat 8.

---

### 🟡 7 — `prevented` manque à la liste des statuts terminaux

**Code.** Plan `:229` : `["won", "lost", "warning_closed"]`. Spec `:88-91` énumère les mêmes sept valeurs, sans `prevented`.

**Preuve.** `node_modules/stripe/cjs/resources/Disputes.d.ts:237` :

```ts
type Status = 'lost' | 'needs_response' | 'prevented' | 'under_review' | 'warning_closed' | 'warning_needs_response' | 'warning_under_review' | 'won' | OtherString;
```

Conséquence : un `charge.dispute.updated` en retard portant `under_review` écraserait un `prevented` déjà acquis. Ajouter `"prevented"` (et le mapper en `success` dans `disputeBadge`, pas en `danger` par défaut). **Régression :** NON.

---

### 🟡 8 — `request_three_d_secure` ne couvre pas Link

Voir §5, question 2, pour l'argumentaire complet. Constat : `Checkout.SessionCreateParams.PaymentMethodOptions.Link` (`Sessions.d.ts:3854-3859`) n'expose que `capture_method` et `setup_future_usage` ; `request_three_d_secure` n'existe que sous `.card` (`Sessions.d.ts:3642`). **Régression :** NON.

---

### 🟡 9 — Comptes anonymisés

[features/users/cron.ts:32-37](features/users/cron.ts#L32-L37) réécrit `email` en `deleted-${id}@deleted.invalid` et pose `anonymizedAt`, 30 jours après `deletedAt` ([features/users/lib/account-deletion.ts:2](features/users/lib/account-deletion.ts#L2)). Un `checkout.session.async_payment_succeeded` (virement) peut arriver dans cette fenêtre. Le plan enverrait alors un courriel vers un TLD réservé → hard bounce SES. Garde à ajouter dans `sendConfirmation` : lire `anonymizedAt` sous le verrou (une colonne de plus dans le `select`) et ne rien envoyer si non nul. Corollaire à noter : `lockedUser?.email ?? ""` (plan `:1289`) enverrait un `ToAddresses: [""]` — préférer `not_found`-like et une capture explicite. **Régression :** NON.

---

### 🟡 10 — « Répondez à ce courriel » sans boîte de réponse ni adresse de support

[email/send.ts:34-51](email/send.ts#L34-L51) construit le `SendEmailCommand` sans `ReplyToAddresses`. La réponse partirait donc vers `EMAIL_FROM`, dont rien dans le dépôt n'atteste qu'il s'agit d'une boîte lue ; aucun gabarit existant n'invite d'ailleurs à répondre (`grep -rn "Répondez\|support@\|contact@" email/templates/*.tsx` → aucun résultat). Par ailleurs le spec `:120` demande « adresse de support » dans le contenu, et le gabarit du plan (`:880-915`) n'en contient pas. Le plan ne modifie pas `email/send.ts`. **Trou spec→plan.** **Régression :** NON.

---

### 🟡 11 — La couverture annoncée n'est vérifiée par aucune des commandes prescrites

Plan `:2320-2322` : `bun run check && bun run test && bun run test:integration` → « Expected: tout vert, couverture ≥ 80 % sur les quatre axes ». Or `test = vitest run --project frontend` (sans `--coverage`) et `test:integration = bun scripts/test-integration.ts` (idem). Les seuils vivent dans [vitest.config.ts:116-121](vitest.config.ts#L116-L121) et [vitest.coverage.config.ts:36-41](vitest.coverage.config.ts#L36-L41), exercés par la CI via `test:coverage` et `test:coverage:full` ([.github/workflows/ci.yml](.github/workflows/ci.yml) lignes 56 et 90).

Deux risques réels de dérive, mesurables uniquement par ces commandes :

- `components/shared/payments/dispute-badge.ts` est un `.ts` ; l'`include` des deux configs est `components/**/*.tsx`. Ses quatre tests dédiés ne comptent donc **pas**, tandis que `transaction-table.tsx` — lui inclus — gagne le composant `DisputeBadge` et la table `disputeToneClass`. Aucun test de `tests/components/payments/TransactionTable.test.tsx` ne pose `disputeStatus` : la branche « badge non nul » et les trois entrées de tons restent mortes.
- `email/index.tsx` : le seul test proposé pour `sendPurchaseConfirmationEmail` passe `presentmentAmount`/`presentmentCurrency` renseignés ; la branche `: null` du ternaire (`:1425-1428`) n'est jamais prise.

**Correctif.** Remplacer la commande de clôture par `bun run test:coverage` puis `bun run test:coverage:full` ; nommer le fichier `dispute-badge.tsx` (ou déplacer la logique dans `transaction-table.tsx`) ; ajouter un cas de rendu avec `disputeStatus` dans `TransactionTable.test.tsx` et un cas sans montant local dans `tests/email/index.test.ts`. **Régression :** NON.

---

### 🟡 12 — Placement du test enrichi de `completeStripeTransaction`

`tests/integration/payments-stripe.test.ts:237` fait `expect(approxDays(acc.expiresAt, 90)).toBe(true)` sur `U_HAPPY`. Le fulfillment non-combo **cumule** ([features/payments/stripe.ts:117-122](features/payments/stripe.ts#L117-L122)). Le nouveau test du plan (`:1201-1235`) complète une seconde transaction de 90 j pour `U_HAPPY`. Inséré avant la ligne 213, il ferait passer l'accès à 180 j et casserait l'assertion. Le plan dit seulement « dans `describe("completeStripeTransaction", …)` ». **Correctif :** préciser « en fin de `describe` », ou plus sûrement utiliser un 15ᵉ utilisateur dédié (`U_CONFIRM`) — le `afterAll` nettoie par `inArray(…, U)`, donc c'est gratuit. **Régression :** NON.

---

## 4. Faux positifs écartés

| Suspecté | Écarté — preuve |
|---|---|
| `vi.mock("@/db/schema")` de `tests/features/payments-actions.test.ts:71-85` ne définit pas `products.name` → le `select` ajouté par la Task 4 casse | `selectChain()` (`:54-62`) ignore totalement son argument et renvoie `mocks.productRows.current`. `products.name` vaut `undefined`, sans effet. Le plan a raison d'ajouter `name` à `ACTIVE_PRODUCT`. |
| `markConfirmationEmailSent` utilise le `db` global depuis le webhook → interblocage du pool (`max: 5`, piège maison connu) | L'appel a lieu **après** le retour de `completeStripeTransaction`, donc après COMMIT et libération de la connexion ([features/payments/stripe.ts:65](features/payments/stripe.ts#L65) et `:214`). Aucune imbrication. [db/index.ts:11-15](db/index.ts#L11-L15) borne en plus l'acquisition à 10 s. |
| `groupBy(examParticipations.id, exams.title)` insuffisant pour Postgres (question ouverte 8) | `examParticipations.id` est PRIMARY KEY (`db/schema/exams.ts:78`), `exams.title` est explicitement groupé, `trainingSessions.id` est PRIMARY KEY (`db/schema/training.ts:19`). Postgres autorise toute colonne fonctionnellement dépendante d'une PK groupée. Le `groupBy` du plan est **correct**. |
| Course entre deux `recordStripeDispute` concurrents (question ouverte 3) | Sérialisation correcte. En READ COMMITTED, l'UPDATE non terminal bloqué par l'UPDATE terminal réévalue son `WHERE` sur la **nouvelle** version de ligne (EvalPlanQual) : `status = 'won'` échoue au `NOT IN` → 0 ligne. Dans l'ordre inverse, l'UPDATE terminal n'a aucune condition et gagne. L'atomicité d'un seul UPDATE suffit. |
| PII dans les `detail` Sentry (interdit par [lib/observability.ts:11-13](lib/observability.ts#L11-L13)) | Les `detail` du plan ne portent que des identifiants Stripe, montants, devises, motifs et `transactionId`. Aucun courriel, nom ni IP. |
| `Stripe.Radar.EarlyFraudWarning`, son `payment_intent`, `Stripe.Dispute.status`, `evidence_details.due_by` absents du SDK 22.4.0 (question ouverte 9) | Tous présents : `Radar/EarlyFraudWarnings.d.ts:18` (interface), `:49` (`payment_intent?: string \| PaymentIntent`, optionnel — le `?.` du plan est correct), `Radar/index.d.ts:21` (ré-export sous `Stripe.Radar`), `Disputes.d.ts:93` (`status`), `:64` + `:212` (`evidence_details.due_by: number \| null`). |
| `charge.dispute.updated/closed/funds_reinstated` et `radar.early_fraud_warning.created` absents de l'union `Stripe.Event["type"]` → erreur `tsc` sur les `case` | Les quatre sont présents (`Events.d.ts:78`, et interfaces dédiées `:504`, `:530`, `:556`, `:2506`). |
| Le badge de litige fuit vers l'espace étudiant via `abonnements-client.tsx:216` | Cet écran a son **propre** adaptateur (« Adapte le modèle DAL au contrat (numérique) attendu par TransactionTable ») et ne passe pas par `adminTransactionToRow`. `disputeStatus?` étant optionnel, aucune erreur de type, aucun affichage. Les deux écrans admin (`transactions-manager.tsx:82`, `user-detail-client.tsx:58`) passent bien par l'adaptateur modifié → le badge apparaît aux deux endroits. |
| La migration n'est pas appliquée sur la branche Neon éphémère → les tests d'intégration échouent | `scripts/test-integration.ts:50` exécute `bun run db:migrate` sur la branche fraîche avant vitest. |
| `and(eq(…), undefined)` (branche `incomingIsTerminal`) produit un SQL invalide | `and()` de Drizzle filtre les `undefined` ; le prédicat se réduit à l'`eq`. |
| `tsc` cassera partout où `AdminTransactionView` est construit | Aucun site : `grep -rn "AdminTransactionView"` ne renvoie que `dal.ts` (définition + construction), deux annotations de props et un `import type`. Voir constat ℹ️ 13. |

---

## 5. Réponses aux questions ouvertes

### 1. `consent_collection.terms_of_service: "required"` — vérification manuelle suffisante ?

**Non. Il faut un garde-fou, et le moins cher est un ordre de livraison, pas du code.**

Le risque est confirmé par le SDK lui-même (`Checkout/Sessions.d.ts:2458-2460`) : « If set to `required`, it requires customers to check a terms of service checkbox before being able to pay. **There must be a valid terms of service URL set in your Dashboard settings.** » Sans elle, `checkout.sessions.create` lève, le `catch` générique de [features/payments/actions.ts:484-488](features/payments/actions.ts#L484-L488) renvoie « Erreur lors de la création du paiement. Réessayez. » — un message qui invite à retenter une panne permanente. **100 % des ventes tombent**, avec un message qui masque la cause.

Trois raisons de ne pas se contenter de la Task 6 : elle dépend d'une action humaine hors dépôt, elle est vérifiée en test alors que le réglage est de compte (donc partagé, ce que le plan dit — c'est un point pour lui), et rien ne détecte une suppression ultérieure de l'URL.

Recommandation, par ordre de rapport valeur/coût :

1. **Découpler le déploiement** : livrer les Tasks 1-3 et 5 d'abord, puis la Task 4 (`consent_collection`) dans un commit séparé, après confirmation du réglage. Le lot le plus risqué devient isolable par un revert d'une ligne.
2. **Un cas d'erreur explicite** dans le `catch` de `createStripeCheckout`, sur le modèle de `isStripeResourceMissing` déjà présent (`:477-483`) : si l'erreur Stripe mentionne `terms_of_service` / `consent_collection`, alerter avec un `detail` qui nomme la cause, au lieu de « Réessayez ».

Je n'ajouterais **pas** de vérification au démarrage (un appel Stripe au boot casse le démarrage pour une raison différente) ni de paramètre conditionnel (silencieux : on croirait collecter le consentement sans le collecter).

### 2. `request_three_d_secure: "any"` s'applique-t-il aux paiements Link ?

**Non pour la forme « Link comme moyen de paiement », oui pour la forme « Link comme portefeuille de carte ». Le plan doit d'abord établir laquelle a produit le litige d'août — sinon la mesure phare peut manquer exactement le cas qui a motivé l'issue.**

Preuves, du dépôt vers la doc :

- L'option n'existe **que** sous `.card` : `Sessions.d.ts:3642` (`PaymentMethodOptions.Card.request_three_d_secure`). `PaymentMethodOptions.Link` (`Sessions.d.ts:3854-3859`) n'a que `capture_method` et `setup_future_usage`. Un `payment_method_options` est indexé par **type** de moyen de paiement ; il n'y a pas de mécanisme par lequel `.card` gouvernerait le type `link`.
- Côté charge, les deux types coexistent et ne portent pas les mêmes données : `Charges.d.ts:337` `card?`, `:352` `link?`, et `interface Link { country }` (`:1172`) — **aucun** `three_d_secure`, contrairement à `PaymentMethodDetails.Card`. Une charge Link « pure » ne peut donc structurellement pas porter de résultat 3DS.
- La forme portefeuille existe aussi : `Card.Wallet.Link` (`Charges.d.ts:1768`) — là `payment_method_details.card` est peuplé et `request_three_d_secure` s'applique normalement.
- La doc *How disputes work* confirme au passage la valeur de la mesure quand elle s'applique : « Unless the payment was covered by the **liability shift** rule, 80 % of EFWs convert into a fraud dispute… If the payment was covered by liability shift, then you might still receive a dispute. In that case, Stripe automatically provides some evidence for you, such as data from 3D Secure. »

**Action recommandée** : avant d'implémenter la Task 4, lire la charge du litige d'août avec la clé live en lecture — `payment_method_details.type` et la présence de `.card` tranchent en une requête. Si c'est `link` pur, garder quand même `request_three_d_secure` (il couvre les paiements carte directs, majoritaires) mais **corriger le récit du spec** : ce n'est pas la mesure qui adresse le cas d'août, et c'est alors l'EFW + le remboursement proactif qui portent la prévention. Corriger aussi le script (constat 6).

### 3. `recordStripeDispute` sans verrou de ligne — sérialisation correcte ?

**Oui, l'UPDATE unique suffit. Aucun entrelacement ne laisse un statut non terminal gagner.** Détail en §4 (faux positif). En READ COMMITTED, Postgres réévalue le prédicat d'un UPDATE sur la version de ligne réécrite par la transaction concurrente ; le `NOT IN (terminaux)` échoue alors et la ligne est ignorée. Ajouter un `SELECT … FOR UPDATE` serait du bruit.

**Mais la question porte sur le mauvais risque.** Le trou n'est pas la concurrence, c'est l'**identité** du litige (constat 🔴 1) : le prédicat ne distingue pas « redélivrance d'un statut ancien du même litige » de « premier statut d'un nouveau litige ». Corriger là.

### 4. `warning_closed` peut-il repasser à `needs_response` ?

**Pas sur le même objet Dispute — le plan a raison sur ce point précis. Mais le garde-fou bloque quand même une vraie transition, par un autre chemin.**

La doc est explicite : « `warning_closed`: The inquiry has been open for 120 days without escalation to a chargeback. » et « If an inquiry remains open for 120 days without escalating to a chargeback, Stripe marks it as closed in both the Dashboard and API. **At this point, the card network won't escalate it.** » `warning_closed` est donc bien terminal pour son objet.

L'escalade réelle se produit **avant** `warning_closed`, depuis `warning_needs_response` / `warning_under_review` — deux statuts que le plan classe correctement comme non terminaux. Sur ce chemin-là, pas de problème.

Le blocage vient d'ailleurs, et il est réel : *Receive multiple disputes* — un second objet Dispute sur le même paiement. Comme le garde-fou est indexé sur `payment_intent`, un `warning_closed` (ou un `won`, ou un `lost`) laissé par le litige précédent bloque l'enregistrement du suivant. Voir constat 🔴 1 : le correctif est de scoper au `stripe_dispute_id`, ce qui rend accessoire le débat sur la terminalité de `warning_closed`.

Ajouter au passage `prevented` à la liste (constat 7).

### 5. Le courriel dans la requête webhook — `waitUntil` nécessaire ?

**Oui. C'est le constat 🔴 2**, argumenté ci-dessus avec les deux citations normatives de `docs.stripe.com/webhooks` (« must quickly return a successful status code (2xx) before any complex logic that could cause a timeout » et, dans la table de debug, « Make sure you defer complex logic and return a successful response immediately »).

Sur le délai SES : je ne peux pas le mesurer ici sans envoyer, et la doc Stripe ne publie pas de valeur numérique de délai d'expiration sur cette page — elle publie la **règle**, qui est plus contraignante qu'un seuil et qui suffit à trancher. Ce qui est mesurable dans le dépôt, c'est que le travail ajouté n'est pas seulement un aller-retour SES : `sendEmail` effectue **deux** rendus React Email complets ([email/send.ts:29-32](email/send.ts#L29-L32)) avant l'appel réseau, sur une fonction potentiellement froide.

Et la conséquence est bien celle que la question suppose : retry → `already_processed` → pas de courriel, **sans** capture Sentry (la fonction est tuée avant le `catch`). `waitUntil` de `@vercel/functions`, déjà dépendance ([db/index.ts:1](db/index.ts#L1)), supprime le couplage en une ligne.

### 6. « Répondez à ce courriel » — `EMAIL_FROM` est-il une boîte lue ?

**Je ne peux pas l'affirmer, et c'est précisément le problème : rien dans le dépôt ne le documente, et le code va dans l'autre sens.** [email/send.ts:34-51](email/send.ts#L34-L51) ne pose aucun `ReplyToAddresses` ; `EMAIL_FROM` est déclarée `z.string().optional()` ([lib/env/schema.ts:38](lib/env/schema.ts#L38)) sans contrainte ni commentaire ; et aucun gabarit existant n'invite à répondre (recherche `Répondez|support@|contact@|Une question` sur `email/templates/*.tsx` → aucun résultat). Je n'ai pas lu la valeur de `.env.local`, conformément à la consigne.

**Recommandation** : ne pas faire reposer une promesse client sur une hypothèse non écrite. Ajouter une variable `SUPPORT_EMAIL` (optionnelle, schéma zod), la passer au gabarit, et l'utiliser à la fois pour le texte (« Écrivez-nous à … ») et pour un `ReplyToAddresses` dans `sendEmail` quand elle est présente. Cela referme aussi le trou spec→plan du constat 10 (le spec demande une adresse de support que le gabarit n'a pas). Si l'utilisateur confirme que `EMAIL_FROM` est bien lue, un `ReplyToAddresses` reste souhaitable : il découple l'expéditeur technique de la boîte de contact.

### 7. Comptes anonymisés

**Oui, le cas est atteignable, et oui il faut ne rien envoyer.** Voir constat 9. La fenêtre est étroite (`DELETION_GRACE_MS` = 30 j, et une session Checkout expire en 24 h) mais le chemin `checkout.session.async_payment_succeeded` — explicitement maintenu comme chemin d'octroi ([app/api/stripe/webhook/route.ts:62-68](app/api/stripe/webhook/route.ts#L62-L68)) — n'a pas cette borne. Le coût du garde est d'une colonne dans le `select` sous verrou et d'un `if`. Le coût de l'omission est un hard bounce vers un TLD réservé, qui pèse sur la réputation d'expédition SES du domaine entier.

Corriger dans la foulée `lockedUser?.email ?? ""` : une chaîne vide n'est pas un repli, c'est un appel SES garanti en échec. Préférer ne pas appeler et capturer explicitement.

### 8. `groupBy(examParticipations.id, exams.title)` suffisant ?

**Oui, tel quel.** Postgres accepte toute colonne fonctionnellement dépendante d'une clé primaire figurant dans le `GROUP BY`. `examParticipations.id` est `.primaryKey()` (`db/schema/exams.ts:78`), donc `startedAt`, `completedAt`, `status` et `resultsNotifiedAt` sont couverts ; `exams.title`, venant d'une autre table, est explicitement groupé. Même raisonnement pour `groupBy(trainingSessions.id)` (`db/schema/training.ts:19`). Faux positif consigné en §4.

Deux remarques mineures sur la même requête, sans gravité : le `isNotNull(examAnswers.selectedAnswer)` dans la condition de jointure est redondant avec `count(examAnswers.selectedAnswer)`, qui ignore déjà les NULL ; et les deux requêtes ont un `.limit(1000)` **sans `orderBy`** — la troncature serait donc arbitraire si un utilisateur dépassait 1 000 participations. Ajouter `orderBy(examParticipations.startedAt)` rend le résultat déterministe pour un coût nul.

### 9. Les types Stripe existent-ils dans `stripe@22.4.0` ?

**Tous, oui.** Faux positif consigné en §4 avec les références exactes. Deux précisions utiles à l'implémentation :

- `EarlyFraudWarning.payment_intent` est **optionnel** (`payment_intent?: string | PaymentIntent`, `Radar/EarlyFraudWarnings.d.ts:49`) : le `?.id` du plan est nécessaire, pas décoratif.
- `evidence_details` n'est **pas** optionnel (`Disputes.d.ts:64`), seul `due_by` est nullable (`:212`). Le `d.evidence_details?.due_by` du plan fonctionne ; si le projet activait un jour `@typescript-eslint/no-unnecessary-condition`, l'optional chaining deviendrait un avertissement — non bloquant aujourd'hui (`bun run lint` est vert sur la config actuelle).
- `Dispute.Status` inclut `prevented` et `OtherString` (`:237`) : le choix du spec de stocker le statut en **texte libre** est confirmé bon, et le `default` de `disputeBadge` reste nécessaire.

### 10. Migration au build Vercel prod — verrou ou ordre cassé ?

**Aucun des deux, sous une réserve.**

- **Verrou** : quatre `ALTER TABLE … ADD COLUMN … ` nullables, sans `DEFAULT` ni `NOT NULL`. Depuis Postgres 11, c'est une opération de catalogue : pas de réécriture de table, `ACCESS EXCLUSIVE` pris et relâché immédiatement. Le seul risque résiduel est la **file d'attente** du verrou derrière une requête longue sur `transactions` ; les lectures du dépôt sont toutes bornées (`.limit(n)`, pagination keyset) et le build de prod n'est pas une heure de pointe. Un `SET lock_timeout` serait du zèle ici.
- **Ordre** : `build:vercel = bun scripts/migrate-deploy.ts && next build` (package.json). Les colonnes existent donc **avant** que le code neuf ne soit compilé, a fortiori avant sa promotion. Le sens inverse (colonnes présentes, ancien code encore servi le temps de la bascule) est inoffensif : nullable, non lu.
- **Réserve** : le plan génère la migration en Task 1 mais le code qui écrit ces colonnes arrive en Tasks 2/5/8. Si les tâches sont livrées en plusieurs déploiements, chaque état intermédiaire reste valide — c'est bien de l'expand-only. En revanche, **un rollback de code après déploiement laisse les colonnes en place** : sans migration descendante, c'est le comportement souhaité, mais il faut le savoir avant de faire un `git revert` sur la Task 1 seule (qui, lui, casserait : le schéma Drizzle ne décrirait plus des colonnes existantes — inoffensif pour Postgres, mais `drizzle-kit generate` produirait ensuite un `DROP COLUMN`). Ne jamais reverter la Task 1 isolément.

---

## 6. Verdict

> **Le plan est-il sûr et complet pour être implémenté tel quel ? NON.**

Le plan est de bonne facture : ses ancres sont exactes (les 20 chaînes et positions que j'ai vérifiées existent toutes dans l'arbre courant, y compris `length: 13`, `priceCad: 5000,` unique en ligne 120, `0014_` comme prochain numéro de migration, `AUDIT_STRIPE_KEY` comme nom retenu, et les quatre sections de `.claude/rules/payments.md`), ses types concordent d'une tâche à l'autre, et il ne contredit aucune règle du dépôt. Il couvre l'intégralité des trois lots du spec, et n'ajoute rien hors périmètre sauf `dispute-badge.ts` (logique extraite, justifiée) et `markConfirmationEmailSent` (implicite dans le spec).

Deux défauts le rendent néanmoins non livrable en l'état, et tous deux touchent le cœur de l'objectif — l'un rend le suivi de litige aveugle au moment où il compte, l'autre peut faire disparaître silencieusement le courriel que la feature existe pour envoyer.

### À corriger AVANT de coder

| # | Correctif | Tâche |
|---|---|---|
| 1 | Scoper le garde-fou terminal au `stripe_dispute_id` ; alerter sur `kept_terminal` d'un litige différent ; ajouter le test « second litige sur le même paiement » | Task 2 |
| 2 | `waitUntil(sendConfirmation(result))` au lieu d'`await` ; adapter les tests | Task 9 |
| 5 | Émettre l'alerte de cycle de vie **avant** l'écriture DB ; ne pas remplacer l'alerte « litige ouvert » par celle du `not_found` | Task 3 |
| 3 | Renvoyer les expirations réellement octroyées (une par type d'accès) au lieu de `txAccessExpiresAt` | Task 8 + Task 7 |
| 6 | Gérer `payment_method_details.link` dans le script ; afficher le type de moyen de paiement | Task 11 |
| 8 | Trancher la forme du paiement d'août (charge live) avant d'écrire le récit du spec autour du 3DS | Task 6, en amont |

### À surveiller PENDANT l'implémentation

| # | Point |
|---|---|
| 4 | Les deux assertions ICU du plan échouent : normaliser les espaces insécables, tester la valeur et non un fragment groupé |
| 12 | Placer le test enrichi en fin de `describe`, ou lui donner un `U_CONFIRM` dédié (`length: 15`) |
| 7 | Ajouter `prevented` aux terminaux et le mapper en `success` dans `disputeBadge` |
| 9 | Garde sur `anonymizedAt` ; ne jamais appeler SES avec un courriel vide |
| 13 | Ne pas chercher les erreurs `tsc` annoncées en Task 5 Step 5 : il n'y en aura pas |
| 14 | Ordre des imports Prettier dans `email/index.tsx` (`@/` avant les relatifs, relatifs triés) |
| 10 | Trancher `EMAIL_FROM` / `SUPPORT_EMAIL` avant d'écrire le gabarit (une adresse de support est demandée par le spec) |

### Polish

| # | Point |
|---|---|
| 11 | Clôturer avec `bun run test:coverage` + `test:coverage:full` ; renommer `dispute-badge.ts` en `.tsx` ; un test de rendu avec `disputeStatus` ; un cas sans montant local dans `tests/email/index.test.ts` |
| 8 (Q) | `orderBy` sur les deux requêtes bornées à 1 000 du script ; retirer le `isNotNull` redondant dans la condition de jointure |
| 1 (Q) | Livrer la Task 4 (`consent_collection`) dans un commit isolé, après confirmation du réglage Dashboard ; message d'erreur dédié dans le `catch` de `createStripeCheckout` |

---

## 7. Confirmations de sécurité opérationnelle

**Touché** — un seul fichier écrit, ce rapport : `docs/superpowers/reviews/2026-09-02-revue-design-prevention-litiges-stripe.md`. Non commité : la décision revient à la session demandeuse.

**Non touché** — aucune modification du code applicatif, du spec, du plan, des tests, du schéma ou de la configuration. `git status` était propre au début et le reste hors ce rapport. Aucun fichier temporaire laissé dans le dépôt.

**Commandes exécutées** — lectures (`cat`, `sed -n`, `grep`, `ls`, `find`, `cat -A`), inspections `git log` / `git status`, un `node -e` de calcul pur en mémoire (formatage `Intl`, aucune E/S), et l'unique commande de contrôle autorisée : `bun run check && bun run test` (exit 0). `bun run test:integration` **non lancé** — aucune branche Neon créée.

**Ressources distantes** — deux `WebFetch` en lecture sur la documentation publique `docs.stripe.com` (pages `/webhooks` et `/disputes/how-disputes-work`, plus deux pages d'index sans contenu exploitable). Aucune commande Stripe, aucune écriture Stripe, aucun appel AWS, aucune opération Neon, aucun déploiement, aucune commande destructive.

**Secrets** — `.env.local` n'a jamais été affiché. La seule interrogation le concernant est un `grep -c "EMAIL_FROM"` renvoyant le nombre de lignes correspondantes (`1`), sans jamais exposer de valeur. C'est d'ailleurs pourquoi la question 6 reste ouverte côté utilisateur plutôt que tranchée ici.
