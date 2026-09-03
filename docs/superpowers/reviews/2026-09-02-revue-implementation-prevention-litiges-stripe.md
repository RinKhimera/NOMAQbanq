# Revue adversariale d'implémentation — Prévention des litiges Stripe (PR #158)

## 1. En-tête

**Date** : 2026-09-02
**Périmètre** : `git diff main...HEAD` sur `feat/prevention-litiges-stripe` (`0e0ab92`), 21 commits, 32 fichiers, 8 370 insertions / 26 suppressions.
**Méthode** : lecture seule, posture hostile. Chaque constat porte une référence `fichier:ligne` vérifiée dans le code livré (pas dans le message de commit ni dans le plan). Chaque défaut suspecté a subi une tentative de réfutation ; ce qui y a survécu est en §3, le reste en §4. La revue de design du 2026-09-02 a été lue d'abord : son rôle ici est de vérifier que le code livre ce que le plan corrigé promettait.

**État du contrôle**

```
$ bun run check && bun run test
prettier --check .        → All matched files use Prettier code style!
tsc --noEmit              → OK
eslint --max-warnings 0   → OK
vitest run --project frontend → Test Files 124 passed · Tests 1414 passed
EXIT_CODE=0
```

Contrôle complémentaire (local, aucune ressource distante) :

```
$ bun run test:coverage
Statements 84.68 % · Branches 80.99 % · Functions 81.96 % · Lines 85.6 %   → seuils 80/80/80/80 tenus
EXIT_CODE=0
```

`test:integration` et `test:coverage:full` n'ont pas été lancés (branche Neon), conformément à la consigne. **Les tests d'intégration de cette PR — dont les six qui verrouillent `recordStripeDispute` — n'ont donc pas été exécutés dans cette revue.**

**Les 14 constats de la revue de design ont tous été traités dans le code**, y compris les deux 🔴 (garde-fou scopé au `stripeDisputeId`, courriel passé à `waitUntil`) et les correctifs de moindre priorité (`prevented` ajouté aux statuts terminaux, `grantedAccess` par type, cas Link dans le script, `SUPPORT_EMAIL` + `Reply-To`, `U_CONFIRM` dédié, normalisation ICU dans les assertions). Le travail est solide ; les constats ci-dessous sont ce qui reste.

---

## 2. Tableau des constats

| #   | Sév | fichier:ligne                                                                         | problème                                                                                                                                                  | régression ? |
| --- | --- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | 🟠  | [features/payments/stripe.ts:364](features/payments/stripe.ts#L364)                     | Le statut **terminal** d'un litige écrase **inconditionnellement** un litige DIFFÉRENT encore vivant. Un `closed/won` de `dp_A` livré en retard repeint le badge en vert alors que `dp_B` court. Aucun test jumeau. | NON          |
| 2   | 🟡  | [scripts/dispute-evidence.ts:8](scripts/dispute-evidence.ts#L8), `:268` vs [.gitignore:66](.gitignore#L66) | Les deux exemples d'usage du script (`--out dossier.md`, `--out fichier.md`) produisent un fichier qui **n'est pas couvert** par le motif `dispute-evidence*.md`. Contenu : nom, courriel, IP du client. | NON          |
| 3   | 🟡  | [features/payments/actions.ts:46](features/payments/actions.ts#L46)                     | `param.startsWith("consent_collection")` repose sur une valeur de `param` **jamais vérifiée auprès de Stripe** ; le test l'invente. Si Stripe renvoie `param: null` (erreur de configuration de compte), la branche est morte et 100 % des ventes tombent sur « Réessayez ». | NON          |
| 4   | 🟡  | [app/api/stripe/webhook/route.ts:1](app/api/stripe/webhook/route.ts#L1) + `:145`        | `waitUntil` de `@vercel/functions` est un **no-op silencieux** hors contexte Vercel. Next 16 fournit `after()` (`next/server`), qui a un repli local. En dev, le courriel ne part aujourd'hui que par effet de bord du process long. | NON          |
| 5   | 🟡  | [email/index.tsx:131](email/index.tsx#L131) + [lib/env/schema.ts:44](lib/env/schema.ts#L44) | `SUPPORT_EMAIL` est optionnelle sans aucun signal : non définie en prod, l'appel à l'action anti-litige ET le `Reply-To` disparaissent **en silence** du courriel dont c'est la raison d'être. | NON          |
| 6   | ℹ️  | [app/api/stripe/webhook/route.ts:48](app/api/stripe/webhook/route.ts#L48)               | Compte anonymisé = cas **attendu et documenté**, mais traité par un `throw` → `captureServerError`, donc une erreur Sentry. Contredit la doctrine de [lib/observability.ts:5-9](lib/observability.ts#L5-L9). | NON          |
| 7   | ℹ️  | [db/schema/payments.ts:118-126](db/schema/payments.ts#L118-L126)                         | `stripe_payment_intent_id` n'a **aucun index** alors que `recordStripeDispute` y fait un UPDATE puis un SELECT sur chaque événement de litige (balayage séquentiel). | NON          |
| 8   | ℹ️  | [vitest.config.ts:38-44](vitest.config.ts#L38-L44)                                       | `dispute-badge.ts` (`.ts`) échappe à l'`include` `components/**/*.tsx` : ses 4 tests ne comptent pas, et `transaction-table.tsx` tombe à **74 % de branches**. Correctif de la revue de design non appliqué. | NON          |

Aucun constat 🔴. **Aucune régression détectée** : les huit constats portent sur du code neuf ou sur de l'outillage.

---

## 3. Détail par constat

### 🟠 1 — Un litige clos écrase un litige vivant, dans le sens inverse de celui que la revue de design a corrigé

**Code.** [features/payments/stripe.ts:342-375](features/payments/stripe.ts#L342-L375) :

```ts
const incomingIsTerminal = (TERMINAL_DISPUTE_STATUSES as readonly string[])
  .includes(params.disputeStatus)
// …
.where(and(
  matchesTransaction,
  incomingIsTerminal
    ? undefined                       // ← aucune garde
    : or(
        isNull(transactions.stripeDisputeId),
        ne(transactions.stripeDisputeId, params.stripeDisputeId),
        isNull(transactions.disputeStatus),
        notInArray(transactions.disputeStatus, [...TERMINAL_DISPUTE_STATUSES]),
      ),
))
```

Le garde-fou est **asymétrique**. Il vérifie l'identité du litige (`ne(...)`, ligne 368) uniquement quand le statut entrant est NON terminal. Quand il est terminal, `incomingIsTerminal` vaut `true`, `and()` de Drizzle élimine l'`undefined`, et le prédicat se réduit à `matchesTransaction` : **écrasement inconditionnel, quel que soit le litige déjà en base**.

**Pourquoi c'est un vrai bug.** Déclencheur concret, sans concurrence exotique :

1. `dp_A` s'ouvre sur `pi_X`, se clôt en `won`. Stripe émet `charge.dispute.closed`.
2. La livraison de cet événement échoue (déploiement, 500 transitoire, Neon indisponible → le webhook renvoie 500 par contrat). Stripe retente avec back-off, jusqu'à 3 jours.
3. Entre-temps le client refile — Stripe documente le cas : « In extremely rare cases, you might receive more than one dispute per payment… the issuer acquired new information about the payment allowing them to refile a dispute ». `dp_B` arrive en `needs_response` et est correctement enregistré (`ne(dp_A, dp_B)` → `recorded`).
4. Le rejeu de `dp_A / closed / won` finit par passer. `incomingIsTerminal = true` → **plus aucune garde** → la ligne repasse à `stripe_dispute_id = dp_A`, `dispute_status = "won"`.

`/admin/transactions` affiche « Litige gagné » en vert ([components/shared/payments/dispute-badge.ts:19-20](components/shared/payments/dispute-badge.ts#L19-L20)) pendant que la fenêtre de réponse de `dp_B` — 7 à 21 jours — s'écoule. Les `charge.dispute.updated` suivants de `dp_B` ne rétablissent rien : ils sont non terminaux, `ne(dp_A, dp_B)` est vrai, donc `recorded`… mais seulement au prochain `updated`, qui peut ne jamais venir si le statut de `dp_B` ne bouge plus avant l'échéance. Et le webhook n'alerte que sur `not_found`, jamais sur un écrasement ([app/api/stripe/webhook/route.ts:235-242](app/api/stripe/webhook/route.ts#L235-L242)).

C'est le miroir exact du constat 🔴 1 de la revue de design (« un litige gagné masquerait un chargeback vivant »), corrigé dans un sens et laissé ouvert dans l'autre. Le commentaire de la fonction ([`:334-336`](features/payments/stripe.ts#L334-L336)) et [.claude/rules/payments.md:63-66](.claude/rules/payments.md#L63-L66) énoncent la règle « un litige d'id différent remplace toujours le précédent, même clos » — la règle est appliquée fidèlement, mais elle confond **ordre d'arrivée** et **récence**, ce qui est précisément ce que Stripe ne garantit pas.

**Régression ?** NON — code neuf. Mais le défaut annule ponctuellement l'objectif du lot 1.

**Comment je l'ai prouvé.** Lecture de [features/payments/stripe.ts:364-374](features/payments/stripe.ts#L364-L374) : le ternaire ne mentionne `params.stripeDisputeId` que dans la branche non terminale. Recherche du test jumeau : `tests/integration/payments-stripe.test.ts` couvre « même litige, non terminal n’écrase pas terminal » (`:789`), « second litige remplace le précédent, même clos » (`:810`), « terminal remplace non terminal » (`:832`) — **aucun** ne couvre « terminal d'un AUTRE litige n'écrase pas un litige vivant ». Le test `:810` échouerait si `ne(...)` était retiré (vérifié en le simulant mentalement sur le prédicat) : c'est un bon jumeau pour la garde existante, mais il n'y a pas de jumeau pour la garde manquante.

**Correctif suggéré.** Rendre le garde-fou symétrique : ne jamais laisser un statut terminal d'un litige `X` écraser un statut **non terminal** d'un litige `Y ≠ X`.

```ts
const guard = incomingIsTerminal
  ? or(
      isNull(transactions.stripeDisputeId),
      eq(transactions.stripeDisputeId, params.stripeDisputeId),
      // litige différent : on n'écrase que s'il est déjà clos
      notInArray(transactions.disputeStatus, NON_TERMINAL_STATUSES), // ou inArray(TERMINAL)
    )
  : or(/* inchangé */)
```

et alerter Sentry sur le `kept_terminal` qui en résulte (litige entrant ≠ litige stocké), seul cas qui n'est pas une redélivrance. Ajouter le test jumeau : « un `closed/won` d'un litige antérieur n'écrase pas un `needs_response` vivant ».

---

### 🟡 2 — Le dossier de preuves atterrit hors du filet `.gitignore`, avec les données personnelles du client

**Code.** L'en-tête du script, [scripts/dispute-evidence.ts:8](scripts/dispute-evidence.ts#L8) :

```
 *   AUDIT_DATABASE_URL=... [AUDIT_STRIPE_KEY=rk_live_...] bun scripts/dispute-evidence.ts <payment_intent> [--out dossier.md]
```

et le message d'usage affiché à l'utilisateur, [scripts/dispute-evidence.ts:268](scripts/dispute-evidence.ts#L268) : `[--out fichier.md]`. Le filet est [.gitignore:65-66](.gitignore#L65-L66) :

```
# Sortie du script de preuves de litige (donnees personnelles, jamais commitees)
dispute-evidence*.md
```

**Pourquoi c'est un vrai bug.** `dossier.md` et `fichier.md` ne correspondent pas au motif. Un opérateur qui recopie l'exemple — c'est le rôle d'un exemple — produit à la racine du dépôt un fichier contenant le **nom réel**, le **courriel**, et **toutes les adresses IP et user-agents** du client ([scripts/dispute-evidence.ts:167-172](scripts/dispute-evidence.ts#L167-L172), `## customer_name` / `## customer_email_address` en [`:216-217`](scripts/dispute-evidence.ts#L216-L217)). Ce fichier apparaît dans `git status`, est happé par un `git add -A`, et le dépôt est public-adjacent (PR GitHub). Le commit `.gitignore` prouve que l'auteur a identifié le risque ; l'exemple le contourne.

**Régression ?** NON — outillage neuf.

**Comment je l'ai prouvé.** `grep -n "\-\-out" scripts/dispute-evidence.ts` → lignes 8, 268, 424 ; `grep -n "dispute-evidence" .gitignore` → ligne 66. `dossier.md` ∉ `dispute-evidence*.md`.

**Correctif suggéré.** Deux lignes, au choix :

- aligner les exemples (`--out dispute-evidence-pi_3ABC.md`) — minimum ;
- ou, plus robuste, forcer le préfixe dans le code : si `out` ne commence pas par `dispute-evidence`, préfixer (ou refuser en nommant la raison). Le script produit une pièce de dossier, pas un fichier quelconque.

---

### 🟡 3 — L'alerte nommée sur les CGU repose sur un `param` Stripe supposé, verrouillé par un test auto-réalisateur

**Code.** [features/payments/actions.ts:42-47](features/payments/actions.ts#L42-L47) :

```ts
const isStripeConsentConfigError = (error: unknown): boolean =>
  typeof error === "object" && error !== null &&
  typeof (error as { param?: unknown }).param === "string" &&
  (error as { param: string }).param.startsWith("consent_collection")
```

et le test qui le couvre, [tests/features/payments-actions.test.ts:305-309](tests/features/payments-actions.test.ts#L305-L309) :

```ts
mocks.checkoutCreate.mockRejectedValueOnce(
  Object.assign(new Error("terms of service URL missing"), {
    type: "StripeInvalidRequestError",
    param: "consent_collection[terms_of_service]",
  }),
)
```

**Pourquoi c'est un vrai bug.** Le test **fabrique** la valeur que la garde attend. Il échouerait si la garde était retirée (il vérifierait alors le message générique) — c'est donc un vrai jumeau de la garde — mais il ne prouve rien de la réalité Stripe : il verrouille une hypothèse.

Or l'erreur en cause n'est pas un rejet de paramètre malformé mais un rejet de **configuration de compte** (« There must be a valid terms of service URL set in your Dashboard settings »). Stripe renvoie régulièrement `param: null` pour cette famille d'erreurs, le paramètre envoyé étant syntaxiquement valide. Dans ce cas la branche est morte : le `catch` retombe sur le générique de [features/payments/actions.ts:518-521](features/payments/actions.ts#L518-L521), « Erreur lors de la création du paiement. Réessayez. » — un message qui invite à retenter une panne permanente, pendant que **100 % des ventes** tombent, sans que rien ne nomme la cause dans Sentry. C'est exactement le scénario que la Task 6 du plan voulait couvrir.

Je n'ai **pas pu vérifier** la valeur réelle de `param` : elle n'est ni dans les types du SDK (`node_modules/stripe/cjs/resources/Checkout/Sessions.d.ts` documente le prérequis, pas l'erreur), ni dans les pages de doc consultables sans déclencher l'erreur, et provoquer l'erreur exigerait un appel Stripe — interdit par le périmètre de cette revue. Je signale donc une hypothèse non étayée, pas une erreur démontrée.

**Régression ?** NON.

**Comment je l'ai prouvé.** Lecture de [features/payments/actions.ts:42-47](features/payments/actions.ts#L42-L47) et du test `:299-320`. Recherche de la valeur attendue dans le plan : `grep -n "param" docs/superpowers/plans/2026-09-02-prevention-litiges-stripe.md` → ligne 999, où le plan **pose** `param: "consent_collection[terms_of_service]"` sans citer aucune source. Recherche web sur la doc Stripe : la contrainte de configuration est confirmée, la forme de l'erreur ne l'est pas.

**Correctif suggéré.** Élargir la reconnaissance pour qu'elle ne dépende pas d'un seul champ :

```ts
const isStripeConsentConfigError = (error: unknown): boolean => {
  const e = error as { param?: unknown; message?: unknown }
  const param = typeof e.param === "string" ? e.param : ""
  const message = typeof e.message === "string" ? e.message.toLowerCase() : ""
  return param.startsWith("consent_collection")
    || message.includes("terms of service")
    || message.includes("consent_collection")
}
```

et ajouter un cas de test avec `param: null` + le message réel. Vérification empirique possible en 30 s hors revue : retirer temporairement l'URL des CGU dans le **Dashboard test**, tenter un checkout, lire l'erreur telle quelle.

---

### 🟡 4 — `waitUntil` de `@vercel/functions` est un no-op silencieux ; `after()` de Next 16 ne l'est pas

**Code.** [app/api/stripe/webhook/route.ts:1](app/api/stripe/webhook/route.ts#L1) et `:145` :

```ts
import { waitUntil } from "@vercel/functions"
// …
if (result.status === "completed") { waitUntil(sendConfirmation(result)) }
```

Implémentation réelle, `node_modules/@vercel/functions/wait-until.js:25-31` :

```js
const waitUntil = (promise) => { /* … */ return getContext().waitUntil?.(promise) }
```

et `node_modules/@vercel/functions/get-context.js:21-25` :

```js
const SYMBOL_FOR_REQ_CONTEXT = Symbol.for("@vercel/request-context");
function getContext() { return globalThis[SYMBOL_FOR_REQ_CONTEXT]?.get?.() ?? {} }
```

**Pourquoi c'est un vrai bug.** L'optional call `waitUntil?.()` fait de l'absence de contexte un **no-op parfaitement silencieux** : aucune erreur, aucun log, aucune capture. Deux conséquences prouvables :

1. **En local, ce symbole n'existe pas.** Next.js n'installe jamais `Symbol.for("@vercel/request-context")` — vérifié : `grep -r "@vercel/request-context" node_modules/next/dist` → **0 résultat**. Next utilise son propre symbole, `Symbol.for('@next/request-context')` (`node_modules/next/dist/server/after/builtin-request-context.js:28`), et surtout un **repli local** quand aucune plateforme ne fournit de `waitUntil` (`createLocalRequestContext` + `AwaiterOnce`, `node_modules/next/dist/server/after/run-with-after.js:28`). Donc en `bun dev`, `waitUntil(...)` ne fait littéralement rien : le courriel ne part que parce que la promesse a déjà démarré et que le process de dev survit. Le test manuel local n'a donc pas exercé le mécanisme qui tournera en production.
2. **Aucun garde-fou si le contexte manque un jour** (self-host, `next start`, changement de runtime) : le courriel disparaît sans trace, ce qui est exactement le mode de défaillance que le passage à `waitUntil` devait supprimer.

Sur Vercel, le symbole est posé par le bridge de la fonction serverless, et l'usage est documenté par Vercel — je n'affirme donc **pas** que la production est cassée. Je constate qu'un mécanisme portable et testable existe, dans la version de Next installée, et qu'il n'a pas été retenu — alors que [AGENTS.md](AGENTS.md) impose de lire `node_modules/next/dist/docs/` avant tout travail Next.

**Régression ?** NON.

**Comment je l'ai prouvé.** Lecture des trois fichiers de `node_modules` cités ; `grep -rl "@vercel/request-context" node_modules/next/dist/server` → aucun fichier ; `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` : « `after` allows you to schedule work to be executed after a response (or prerender) is finished… It can be used in Server Components, Server Functions, **Route Handlers**, and Proxy », avec `import { after } from 'next/server'`.

**Correctif suggéré.** Une ligne :

```ts
import { after } from "next/server"
// …
if (result.status === "completed") after(() => sendConfirmation(result))
```

Le test `tests/features/stripe-webhook-errors.test.ts` s'adapte en mockant `next/server` plutôt que `@vercel/functions` (le helper `deferred()` devient `mocks.after.mock.calls[0][0]()`). `@vercel/functions` reste requis pour `attachDatabasePool` dans [db/index.ts:1](db/index.ts#L1) — rien d'autre à retirer.

Note associée (ℹ️, même zone) : `markConfirmationEmailSent` tourne dans le même différé. Si l'instance est tuée entre l'envoi SES et l'`UPDATE`, le courriel est parti mais `confirmation_email_sent_at` reste nul — et le dossier de preuves omet alors la ligne « courriel de confirmation envoyé » ([scripts/dispute-evidence.ts:180-186](scripts/dispute-evidence.ts#L180-L186)), c'est-à-dire précisément la pièce que la feature existe pour produire. Le `MessageId` SES reste retrouvable dans CloudWatch, donc ce n'est pas une perte sèche.

---

### 🟡 5 — Le cœur de l'argumentaire anti-litige disparaît en silence si `SUPPORT_EMAIL` n'est pas définie

**Code.** [lib/env/schema.ts:44](lib/env/schema.ts#L44) : `SUPPORT_EMAIL: z.string().optional()`. Trois consommateurs, tous en dégradation muette :

- [email/send.ts:38](email/send.ts#L38) : `...(env.SUPPORT_EMAIL ? { ReplyToAddresses: [env.SUPPORT_EMAIL] } : {})`
- [email/index.tsx:131](email/index.tsx#L131) : `supportEmail={env.SUPPORT_EMAIL ?? null}`
- [email/templates/purchase-confirmation-email.tsx:65-73](email/templates/purchase-confirmation-email.tsx#L65-L73) : `{supportEmail ? (<Text>… Écrivez-nous à … <strong>avant toute démarche auprès de votre banque</strong> …</Text>) : null}`

**Pourquoi c'est un vrai bug.** La phrase « écrivez-nous avant toute démarche auprès de votre banque » est **la** mesure de prévention du courriel : c'est ce qui transforme un client mécontent en demande de remboursement plutôt qu'en chargeback. Si `SUPPORT_EMAIL` n'est pas poussée sur l'environnement `production` de Vercel, le courriel part quand même, complet et crédible, **amputé de sa seule fonction préventive**, et rien ne le signale : pas d'alerte, pas de log, pas d'échec de build. La variable est nouvelle, donc absente par défaut de tous les environnements ; [AGENTS.md](AGENTS.md) rappelle que `.env.local` est généré et qu'une nouvelle variable doit passer par `vercel env add` — une étape manuelle, hors dépôt, qui n'a laissé aucune trace vérifiable dans la PR.

Même remarque pour le `Reply-To` : sans la variable, les réponses aux **cinq** courriels de l'app partent vers `EMAIL_FROM`, une adresse `noreply` (le commentaire de [lib/env/schema.ts:41-43](lib/env/schema.ts#L41-L43) le dit explicitement).

**Régression ?** NON — comportement identique à `main` quand la variable est absente.

**Comment je l'ai prouvé.** `grep -rn "SUPPORT_EMAIL"` sur le dépôt : 4 occurrences de code, 2 de tests, aucune vérification au démarrage ni au premier envoi. Les deux tests (`tests/email/send.test.ts:57-70`, `tests/email/index.test.ts:12-15`) **définissent toujours** la variable via un mock ; le rapport de couverture confirme que la branche `?? null` de [email/index.tsx:131](email/index.tsx#L131) n'est jamais prise (`index.tsx … 75 % branches, uncovered 72,131`).

**Correctif suggéré.** Au choix, par ordre de coût :

1. Vérifier et documenter dans la PR que `SUPPORT_EMAIL` est posée sur `development`, `preview` **et** `production` (c'est ce que la Task 7 du plan prescrit, `:1103-1105`).
2. Ajouter un `captureServerError` unique dans `sendPurchaseConfirmationEmail` quand `env.SUPPORT_EMAIL` est absente en production : le silence devient détectable.
3. Ajouter le test jumeau manquant (`env: {}` → `supportEmail` null) pour couvrir la branche.

---

### ℹ️ 6 — Un compte anonymisé produit une erreur Sentry pour un cas nominal

**Code.** [app/api/stripe/webhook/route.ts:47-67](app/api/stripe/webhook/route.ts#L47-L67) :

```ts
if (!c.userEmail) { throw new Error("compte anonymisé, aucun destinataire") }
// …
} catch (error) { captureServerError("[stripe:webhook]", error, { detail: `courriel … · transaction ${result.transactionId}` }) }
```

`userEmail` est nul **par conception** quand `anonymizedAt` est posé ([features/payments/stripe.ts:243-244](features/payments/stripe.ts#L243-L244)), et [.claude/rules/payments.md:74](.claude/rules/payments.md#L74) énonce la règle : « Compte anonymisé → aucun envoi ». Le passer par un `throw` en fait une exception Sentry, alors que [lib/observability.ts:4-9](lib/observability.ts#L4-L9) pose la doctrine inverse : « Les erreurs métier mappées … sont du flux de contrôle : elles ne passent **JAMAIS** ici — c'est ce qui garde le signal Sentry exploitable ». Le mélange est visible dans le test lui-même (`tests/features/stripe-webhook-errors.test.ts:556-582`), qui attend le même `detail` pour l'anonymisation et pour une panne SES : les deux se regroupent sous le même fingerprint. **Correctif** : `if (!c.userEmail) { console.info(…); return }`, ou un `detail` distinct si la trace est jugée utile. **Régression :** NON.

---

### ℹ️ 7 — `stripe_payment_intent_id` n'est pas indexé alors qu'il devient une clé de jointure chaude

**Code.** [db/schema/payments.ts:118-126](db/schema/payments.ts#L118-L126) : la table déclare huit index, dont `transactions_stripe_session_id_idx`, mais **aucun** sur `stripe_payment_intent_id`. Or [features/payments/stripe.ts:352-383](features/payments/stripe.ts#L352-L383) y fait désormais, sur chaque événement de litige, un `UPDATE … WHERE stripe_payment_intent_id = $1` **sans `LIMIT`** puis un `SELECT` de repli sur le même prédicat : deux balayages séquentiels de `transactions`. La table est petite aujourd'hui et les événements de litige sont rares — d'où le ℹ️ — mais [AGENTS.md](AGENTS.md) pose « Reads bornés » en règle critique, et l'index est une ligne dans le schéma. À faire au prochain `db:generate`, pas maintenant. **Régression :** NON.

---

### ℹ️ 8 — `dispute-badge.ts` est invisible à la couverture, et `transaction-table.tsx` recule à 74 % de branches

**Code.** [vitest.config.ts:38-44](vitest.config.ts#L38-L44) : `include: ["lib/**/*.ts", "hooks/**/*.ts", "components/**/*.tsx", "schemas/**/*.ts", "email/**/*.{ts,tsx}"]`. `components/shared/payments/dispute-badge.ts` porte l'extension `.ts` : il n'est **dans aucun** motif. Ses quatre tests (`tests/components/payments/dispute-badge.test.ts`) sont excellents — ils couvrent les statuts non terminaux, `won`/`prevented`/`lost`/`warning_closed` et le défaut inconnu — mais ne pèsent rien dans la métrique qui garde le CI.

Vérifié dans le rapport que j'ai produit : `dispute-badge.ts` **n'apparaît pas** dans le tableau de couverture, tandis que `transaction-table.tsx` y descend à `90,32 % stmts / 74 % branches / 70 % fn`, lignes non couvertes `78, 362-370`. La couverture globale des branches tient à **80,99 %**, soit 0,99 point au-dessus du seuil — la marge la plus fine que le dépôt ait connue (81,73 % à la clôture de la campagne vitest).

C'était le constat 11 de la revue de design ; il n'a pas été appliqué. **Correctif :** renommer en `dispute-badge.tsx` (aucun autre changement — le fichier n'exporte que du TypeScript pur, `.tsx` l'accepte), ou ajouter `components/**/*.ts` à l'`include` des deux configs. **Régression :** NON.

---

## 4. Faux positifs écartés

| Suspecté                                                                                                                                                              | Écarté — preuve                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Le fulfillment efface un `payment_intent` posé par le repli litige : `set({ stripePaymentIntentId: params.stripePaymentIntentId \|\| null })` ([stripe.ts:196](features/payments/stripe.ts#L196)) | La chaîne `""` ne survient que pour `no_payment_required` ([route.ts:118-121](app/api/stripe/webhook/route.ts#L118-L121)). Or le repli n'atteint cette ligne que via `checkout.sessions.list({ payment_intent })` : une session promo 100 % n'a **pas** de `payment_intent`, elle ne peut donc pas être renvoyée par ce filtre. Et sans charge, il n'y a pas de litige. Chemin inatteignable. |
| Le litige vise une session dont le `payment_intent` diffère de celui qu'écrira le fulfillment                                                                          | Une Checkout Session en mode `payment` porte **un seul** `payment_intent`, réutilisé sur les tentatives ; `session.payment_intent` est stable. La valeur écrite par le repli et celle écrite par le fulfillment sont donc la même chaîne. Aucune divergence possible.                                                                                        |
| `or(eq(pi), eq(session))` sans `LIMIT` touche plusieurs lignes                                                                                                          | Le repli n'est déclenché **que** sur `not_found` de la première passe, c'est-à-dire quand aucune ligne ne porte ce `payment_intent` : seule la ligne de la session peut matcher. `createStripeCheckout` insère exactement un pending par session Stripe. Les transactions manuelles ont les deux colonnes à `NULL`, et `eq(NULL, x)` ne matche jamais.       |
| Deux `recordStripeDispute` concurrents laissent un état incohérent                                                                                                     | UPDATE unique atomique. En READ COMMITTED, le second réévalue son `WHERE` sur la ligne réécrite (EvalPlanQual) : le prédicat non terminal échoue face à un statut terminal fraîchement posé → 0 ligne, `kept_terminal`. Aucun verrou explicite nécessaire.                                                                                                   |
| Double envoi du courriel si Stripe rejoue pendant que le premier `waitUntil` tourne                                                                                    | Le rejeu entre dans `completeStripeTransaction`, se bloque sur le `SELECT … FOR UPDATE` de `user` ([stripe.ts:104-112](features/payments/stripe.ts#L104-L112)), puis voit `stripeEventId` posé ou `status = "completed"` → `already_processed` → [route.ts:144](app/api/stripe/webhook/route.ts#L144) n'appelle pas `waitUntil`. Test jumeau présent (`stripe-webhook-errors.test.ts:545-553`). |
| Interblocage du pool : `markConfirmationEmailSent` prend le `db` global depuis un différé                                                                               | L'appel a lieu **après** le COMMIT de `completeStripeTransaction` — la connexion est rendue. Aucune imbrication. `attachDatabasePool` ([db/index.ts:31](db/index.ts#L31)) draine à la **suspension** de l'instance, que Fluid Compute repousse tant qu'un `waitUntil` est en vol ; et `connectionTimeoutMillis: 10_000` borne toute acquisition. |
| `getBaseUrl()` appelé après la réponse lève (API dynamique hors portée de requête)                                                                                      | [lib/base-url.ts:24-36](lib/base-url.ts#L24-L36) ne lit que `env` et `process.env` — aucun `headers()`/`cookies()`. Sans effet hors requête.                                                                                                                                                                                                            |
| Le badge de litige fuit vers l'espace étudiant                                                                                                                          | `grep -rn "disputeStatus" app components features` → aucune occurrence dans `app/(dashboard)/…/abonnements-client.tsx`, qui a son propre adaptateur (`:216`). `disputeStatus?` est optionnel sur `Transaction` ([transaction-table.tsx:56](components/shared/payments/transaction-table.tsx#L56)) : non fourni ⇒ `disputeBadge(undefined)` ⇒ `null`, aucun rendu. Les deux seuls sites qui passent par `adminTransactionToRow` sont admin (`transactions-manager.tsx:82`, `user-detail-client.tsx:58`), et `getAllTransactions` est gardé par `requireRole(["admin"])` ([dal.ts:341](features/payments/dal.ts#L341)). |
| `leftJoin` sur `exam_answers` multiplie les lignes de participations                                                                                                     | `groupBy(examParticipations.id, exams.title)` ramène chaque participation à un groupe ; `count(examAnswers.selectedAnswer)` compte les réponses de CE groupe et ignore les `NULL`. Deux participations à deux examens ⇒ deux lignes, deux comptes justes. Idem pour `groupBy(trainingSessions.id)` (PK).                                                     |
| `consent_collection` ou `payment_intent_data` cassent les tests E2E de paiement                                                                                          | `grep -rn "checkout.stripe\|E2EPROMO" e2e/` → aucun résultat : aucun scénario Playwright ne traverse la page Checkout hébergée. La case CGU n'a rien à cocher côté E2E.                                                                                                                                                                                    |
| Un utilisateur supprimé (`deletedAt`) mais pas encore anonymisé reçoit le courriel (question ouverte 3)                                                                  | Comportement voulu et correct — voir §5, question 3. L'adresse est encore réelle et délivrable pendant les 30 jours de grâce ; ne pas confirmer un paiement encaissé serait le vrai défaut.                                                                                                                                                               |
| PII dans les `detail` Sentry                                                                                                                                            | Les six `detail` de litige/EFW ne portent que des identifiants Stripe, montants, devises, motifs et statuts ([route.ts:180](app/api/stripe/webhook/route.ts#L180), `:262`) ; celui du courriel ne porte qu'un `transactionId` ([route.ts:66](app/api/stripe/webhook/route.ts#L66)). Aucun courriel, nom ni IP. Voir §5, question 8, pour la réserve sur le corps de l'exception SES. |
| Le rename `STRIPE_AUDIT_KEY` → `AUDIT_STRIPE_KEY` laisse des références mortes                                                                                           | `grep -rn "STRIPE_AUDIT_KEY"` → **0 occurrence** hors documents d'archive. Les trois scripts (`audit-stripe-transactions.ts`, `audit-stripe-orphelins.ts`, `dispute-evidence.ts`) et [.claude/rules/payments.md:79](.claude/rules/payments.md#L79) utilisent tous le nouveau nom. Rename complet.                                                          |
| Le nouveau test d'intégration de `U_CONFIRM` casse `approxDays(…, 90)` de `U_HAPPY` (constat 12 de la revue de design)                                                   | Corrigé : le plan a été suivi, deux utilisateurs dédiés ont été ajoutés (`U = Array.from({ length: 15 }…)`, `U_DISPUTE`, `U_CONFIRM`). `U_HAPPY` n'est plus touché.                                                                                                                                                                                        |

---

## 5. Réponses aux questions ouvertes

### 1. Le repli par session Checkout peut-il laisser la ligne incohérente ?

**Non, sur les deux chemins que vous nommez — et j'ai cherché.**

- **Le `no_payment_required` ne peut pas effacer un `payment_intent` posé par un litige.** `params.stripePaymentIntentId` ne vaut `""` que sur ce statut ([route.ts:118-121](app/api/stripe/webhook/route.ts#L118-L121)), et le repli n'atteint une ligne que par `checkout.sessions.list({ payment_intent })` ([route.ts:221-225](app/api/stripe/webhook/route.ts#L221-L225)). Une session promo 100 % n'a pas de `payment_intent` : ce filtre ne peut structurellement pas la renvoyer. Ajoutez qu'un paiement de 0 $ ne crée pas de charge, donc pas de litige. Le chemin est vide.
- **Le litige ne peut pas viser une session dont le `payment_intent` diffère.** Une Checkout Session en mode `payment` porte un unique `PaymentIntent`, réutilisé sur les tentatives échouées ; `session.payment_intent` est stable de bout en bout. Le repli écrit donc exactement la valeur que le fulfillment réécrira.
- **L'entrelacement concurrent est sérialisé par le verrou de ligne Postgres.** L'UPDATE du repli et celui du fulfillment portent sur la même ligne `transactions`. Dans un ordre : le fulfillment réécrit le même `payment_intent` et ne touche **ni** `stripe_dispute_id` **ni** `dispute_status` (absents de son `set`, [stripe.ts:193-203](features/payments/stripe.ts#L193-L203)) — le litige survit. Dans l'autre : le repli matche désormais par `payment_intent` dès la première passe. Les deux ordres convergent.

Le test d'intégration `« transaction encore pending (sans payment_intent) → rattachée par la session Checkout »` (`tests/integration/payments-stripe.test.ts:862-892`) verrouille le cas nominal, y compris l'assertion `expect((await txStatus(tx))?.pi).toBe(\`pi_${tx}\`)`. **Ce que je ne peux pas confirmer**, c'est qu'il passe : il n'a pas été exécuté ici (branche Neon exclue du périmètre). À faire avant merge.

**Le vrai trou de cette zone est ailleurs** : c'est le constat 🟠 1, l'asymétrie du garde-fou terminal.

### 2. `or(eq(pi), eq(session))` peut-il toucher plusieurs lignes ?

**Non en pratique, mais le schéma ne l'interdit pas — et c'est une fragilité qui mérite d'être connue.**

Les faits, dans [db/schema/payments.ts:118-126](db/schema/payments.ts#L118-L126) :

- `stripe_session_id` porte un index **non unique** (`transactions_stripe_session_id_idx`, ligne 121) ;
- `stripe_payment_intent_id` ne porte **aucun index** ;
- seul `stripe_event_id` est unique (`uniqueIndex`, ligne 119).

Rien en base n'empêche donc deux lignes de partager une session ou un `payment_intent`. Ce qui les en empêche est applicatif : `createStripeCheckout` insère exactement un pending par session Stripe créée ([features/payments/actions.ts:441-497](features/payments/actions.ts#L441-L497)), il n'y a aucune reprise ni retry qui pourrait dupliquer. Et le repli n'est déclenché que sur `not_found`, c'est-à-dire quand **aucune** ligne ne porte le `payment_intent` : à cet instant, seule la ligne de la session peut matcher, l'`or` se réduit à un `eq`.

Deux pendings d'un même utilisateur (deux tentatives) portent bien deux sessions **différentes** ; le filtre par session n'en atteint qu'une. Multi-matching écarté.

Cela dit, l'UPDATE est sans `LIMIT` et sur colonne non indexée : je recommande l'index (constat ℹ️ 7). Une contrainte unique partielle sur `stripe_session_id` (`WHERE stripe_session_id IS NOT NULL`) transformerait l'invariant applicatif en invariant de base — utile, mais hors périmètre de cette PR.

### 3. Un utilisateur supprimé mais pas anonymisé reçoit-il le courriel ? Est-ce voulu ?

**Oui, il le reçoit, et oui c'est le bon comportement.** La garde porte sur `anonymizedAt`, pas sur `deletedAt` ([features/payments/stripe.ts:243-244](features/payments/stripe.ts#L243-L244)).

C'est exactement le bon découpage : ce qui rend l'envoi nuisible n'est pas la suppression, c'est la **réécriture de l'adresse**. `features/users/cron.ts` remplace `email` par `deleted-<id>@deleted.invalid` et pose `anonymizedAt` 30 jours après `deletedAt` (`DELETION_GRACE_MS`, `features/users/lib/account-deletion.ts`). Pendant ces 30 jours l'adresse reste **réelle et délivrable** ; envoyer à un TLD `.invalid` produirait un hard bounce SES pesant sur la réputation du domaine entier, envoyer à une vraie adresse ne coûte rien. Le seul cas atteignable — un `checkout.session.async_payment_succeeded` (virement) qui confirme après la demande de suppression — est précisément celui où le client a payé et doit recevoir sa confirmation : ne rien envoyer serait le défaut.

Le `return … : null` plutôt qu'un `?? ""` est également correct : la revue de design avait pointé qu'une chaîne vide produirait un `ToAddresses: [""]`, appel SES garanti en échec. Le code évite le piège.

**Une seule réserve, mineure** : le cas anonymisé remonte comme une **erreur Sentry** (constat ℹ️ 6), alors qu'il est nominal et documenté.

### 4. `waitUntil` : pool fermé, drain, ou double envoi ?

**Aucun des trois. Mais le mécanisme lui-même est plus fragile que vous ne le pensez — c'est le constat 🟡 4.**

- **Double envoi : non.** Une seconde livraison du même événement se bloque sur `SELECT … FOR UPDATE` ([stripe.ts:104-112](features/payments/stripe.ts#L104-L112)), puis sort en `already_processed` sur `stripeEventId` ou `status = "completed"`. `waitUntil` n'est appelé que sur `status === "completed"` ([route.ts:144-146](app/api/stripe/webhook/route.ts#L144-L146)). Le verrou sérialise, il ne dédouble pas. Test jumeau présent.
- **Pool fermé / drain : non.** `markConfirmationEmailSent` s'exécute après le COMMIT de la transaction de fulfillment ; aucune connexion n'est détenue au moment de l'appel, donc aucune imbrication (le piège maison du pool `max: 5`). `attachDatabasePool` ([db/index.ts:31](db/index.ts#L31)) draine les connexions **idle à la suspension de l'instance** — que Fluid Compute repousse tant qu'un `waitUntil` est en vol ; et `connectionTimeoutMillis: 10_000` garantit une erreur franche plutôt qu'un blocage si le pool était malgré tout saturé.
- **Le vrai risque est en amont** : `waitUntil` de `@vercel/functions` est `getContext().waitUntil?.(promise)` (`node_modules/@vercel/functions/wait-until.js:25-31`). Hors contexte Vercel, c'est un no-op **totalement silencieux**. Et Next.js n'installe jamais ce symbole : `grep -r "@vercel/request-context" node_modules/next/dist` → 0 résultat. Next utilise `Symbol.for('@next/request-context')` et, à défaut de plateforme, un repli local (`AwaiterOnce`). Conséquence vérifiable : **en `bun dev`, votre `waitUntil` ne fait rien** ; le courriel n'est parti pendant vos tests manuels que parce que la promesse avait déjà démarré et que le process de dev survit. Le mécanisme testé n'est pas celui qui tournera en production. `after()` de `next/server`, présent dans la version installée et documenté pour les Route Handlers, n'a pas ce trou.

### 5. Quel `param` Stripe envoie-t-il vraiment quand l'URL des CGU manque ?

**Je ne peux pas le confirmer, et personne dans cette campagne ne l'a fait — c'est le constat 🟡 3.**

Le plan **pose** la valeur (`:999`) sans citer de source ; le test la reproduit (`tests/features/payments-actions.test.ts:308`) ; la garde la lit ([actions.ts:46](features/payments/actions.ts#L46)). Rien dans la chaîne ne remonte à Stripe. La doc confirme le **prérequis** (« There must be a valid terms of service URL set in your Dashboard settings », repris tel quel dans `node_modules/stripe/cjs/resources/Checkout/Sessions.d.ts`) mais pas la **forme de l'erreur**. Or la classe d'erreur est ici « configuration de compte », pas « paramètre malformé » : Stripe renvoie fréquemment `param: null` dans ce cas, le paramètre envoyé étant parfaitement valide.

Je ne dis pas que la branche est morte — je dis qu'aucune preuve ne dit qu'elle est vivante, alors que le coût du doute est élevé (100 % des ventes bloquées derrière un message « Réessayez »). Deux issues, cumulables : élargir la reconnaissance au message de l'erreur (patch en §3), et vérifier empiriquement en retirant l'URL des CGU du Dashboard **test** le temps d'un checkout.

Le reste de la Task 6 est bien implémenté : `payment_intent_data.receipt_email`, `consent_collection`, `request_three_d_secure: "any"` sur `card` uniquement (correct — l'option n'existe pas pour `link`), avec un test qui vérifie la forme exacte des trois paramètres.

### 6. `not_found` résiduel sans 500 : bon choix ?

**Oui, et pour trois raisons cumulatives. Je ne changerais rien.**

1. **Un 500 ne réparerait rien.** Après le repli, `not_found` signifie qu'aucune ligne ne porte ni ce `payment_intent` ni la session que Stripe associe à ce `payment_intent`. Aucun rejeu ne fera apparaître une transaction qui n'existe pas. Le 500 achèterait 3 jours de retries stériles et un endpoint marqué en échec dans le Dashboard, ce qui **retarderait** la livraison des événements suivants — y compris ceux qui, eux, portent des transactions réelles.
2. **Le cas légitime existe.** Un paiement fait hors du parcours applicatif — lien de paiement, encaissement au Dashboard, facture — n'a pas de ligne `transactions`. Le webhook doit acquitter.
3. **L'information n'est pas perdue** : le code émet **deux** alertes, l'alerte de cycle de vie (« litige ouvert sur un paiement Stripe ») **puis** l'alerte dédiée (« litige sans transaction correspondante »), toutes deux avec le `detail` complet — id du litige, montant, devise, motif, statut, `payment_intent` ([route.ts:183-190](app/api/stripe/webhook/route.ts#L183-L190) et `:235-242`). Un humain a tout ce qu'il faut pour ouvrir le Dashboard. Le test `« litige sur un payment_intent sans transaction → alerte de cycle de vie ET alerte dédiée »` (`stripe-webhook-errors.test.ts:407-431`) verrouille l'ordre et le nombre — c'est exactement le correctif que la revue de design demandait.

Sur le cycle de vie : oui, un `updated` suivra en général, et il repassera par le même chemin (le repli est dans la branche commune aux quatre événements), donc une transaction créée entre-temps serait rattrapée. Mais ce n'est pas ce qui justifie le 200 ; c'est le point 1 qui le justifie.

### 7. Le script `dispute-evidence.ts` : `leftJoin` et `--out`

**Le `leftJoin` est correct ; le `--out` a un vrai problème, mais pas celui que vous imaginez.**

- **Pas de multiplication de lignes.** `groupBy(examParticipations.id, exams.title)` ([scripts/dispute-evidence.ts:381](scripts/dispute-evidence.ts#L381)) ramène chaque participation à exactement un groupe : `examParticipations.id` est PRIMARY KEY, donc `startedAt`, `completedAt`, `status` et `resultsNotifiedAt` en sont fonctionnellement dépendants et Postgres les accepte sans les grouper ; `exams.title`, venant d'une autre table, est explicitement listé. `count(examAnswers.selectedAnswer)` compte les réponses **de ce groupe** et ignore les `NULL`. Deux participations à deux examens ⇒ deux lignes, deux comptes justes. Même raisonnement pour `groupBy(trainingSessions.id)`.
  Deux détails sans gravité, notés au passage : `.limit(1000)` **avec** `orderBy(asc(startedAt))` (bien — la revue de design avait signalé l'absence d'ordre, c'est corrigé) ; et `stripe.disputes.list({ payment_intent, limit: 1 })` ([`:397-400`](scripts/dispute-evidence.ts#L397-L400)) ne prend que le litige le plus récent alors que la base stocke maintenant `stripe_dispute_id` — un recoupement gratuit qui n'est pas fait.
- **Le `--out` : le chemin arbitraire n'est pas le problème, le NOM l'est.** Écrire où l'utilisateur demande est le contrat normal d'un outil local lancé à la main avec ses propres droits ; il n'y a ni entrée réseau, ni escalade. Ce qui est un vrai problème, c'est que les **deux exemples fournis par le script lui-même** (`dossier.md`, `fichier.md`) produisent un fichier qui échappe au `.gitignore` posé pour le protéger, et ce fichier contient nom, courriel et adresses IP du client. Voir constat 🟡 2.

### 8. Données personnelles dans Sentry

**Les `detail` sont propres. Une seule zone d'ombre, sur le corps de l'exception SES.**

- **Les `detail` de litige et d'EFW** ne portent que des identifiants Stripe, montants, devises, motifs et statuts ([route.ts:180](app/api/stripe/webhook/route.ts#L180), `:262`). Un `dp_…`, un `pi_…`, un `issfr_…` sont des identifiants opaques de ressources Stripe, pas des données personnelles au sens de [lib/observability.ts:11-13](lib/observability.ts#L11-L13) (« Contexte léger uniquement : pas de payload (PII) »). Idem pour `transactionId`, un `cuid` interne. Le `userId` va dans le champ `user.id` prévu pour, pas dans `extra`.
- **Le `detail` du courriel** est `courriel de confirmation non envoyé · transaction ${result.transactionId}` ([route.ts:66-67](app/api/stripe/webhook/route.ts#L66-L67)) : aucune adresse. Choix correct.
- **La zone d'ombre** : `captureServerError` passe l'**exception elle-même** à `Sentry.captureException` ([lib/observability.ts:24](lib/observability.ts#L24)) et à `console.error` (`:21`). Quand SES rejette un envoi, le message d'erreur du SDK AWS peut contenir l'adresse du destinataire (`MessageRejected: Email address is not verified. The following identities failed…`). Ce n'est pas nouveau — les quatre autres courriels passent déjà par le même chemin — mais cette PR y ajoute un cinquième point d'envoi, sur le flux le plus volumineux. Ce n'est pas un blocage de merge ; c'est une bonne raison de vérifier que le `beforeSend` de la config Sentry scrube les adresses, ou d'attraper l'erreur SES dans `sendEmail` pour n'en propager que le `name`/`code`.
- Le script `dispute-evidence.ts`, lui, manipule bien de la PII (nom, courriel, IP), mais **hors Sentry**, en local, ce qui est son rôle. Voir constat 🟡 2 pour le seul risque associé.

---

## 6. Verdict

> **La PR #158 est-elle mergeable telle quelle ? OUI**, sous deux réserves de vérification, aucune ne portant sur le code livré.

**Aucun constat 🔴, aucune régression.** Les quatorze constats de la revue de design ont été traités, y compris les deux bloquants. Le contrat 400/500/200 du webhook est intact, le fulfillment idempotent sous verrou n'est pas touché, le cumul combo/non-combo est inchangé et désormais mieux testé, les octrois manuels et les autres consommateurs de `AdminTransactionView` ne voient aucune différence de comportement, et le badge ne peut pas atteindre l'espace étudiant.

Les deux réserves préalables au merge ne sont pas des correctifs de code :

1. **Lancer `bun run test:integration`.** Six tests neufs verrouillent `recordStripeDispute` et le repli par session ; le périmètre de cette revue m'interdisait de les exécuter. Rien ne doit être mergé sur cette foi seule.
2. **Confirmer que `SUPPORT_EMAIL` est posée sur `production`** (constat 🟡 5). Sans elle, le courriel part amputé de sa fonction préventive, en silence.

### Priorisation

| Quand                        | Constat                                                                      | Coût     |
| ---------------------------- | ---------------------------------------------------------------------------- | -------- |
| **Bloquant maintenant**      | — (aucun)                                                                    |          |
| **Avant le merge** (vérif.)  | Lancer `bun run test:integration` · confirmer `SUPPORT_EMAIL` en prod (🟡 5) | 10 min   |
| **Avant le prochain déploiement** | 🟠 1 — symétriser le garde-fou terminal + test jumeau                    | ~30 min  |
|                              | 🟡 3 — élargir `isStripeConsentConfigError` au message, ou vérifier le `param` réel en mode test | ~20 min  |
|                              | 🟡 2 — aligner les exemples `--out` sur `dispute-evidence*.md`               | 2 min    |
| **Polish**                   | 🟡 4 — passer à `after()` de `next/server`                                   | ~15 min  |
|                              | ℹ️ 8 — renommer `dispute-badge.ts` → `.tsx` (rend 4 tests visibles, remonte les branches de `transaction-table.tsx`) | 1 min    |
|                              | ℹ️ 6 — compte anonymisé : `return` plutôt que `throw`                        | 2 min    |
|                              | ℹ️ 7 — index sur `stripe_payment_intent_id` (au prochain `db:generate`)      | 5 min    |

Le constat 🟠 1 mérite d'être corrigé avant le prochain déploiement plutôt que d'être bloquant : il exige deux litiges sur un même paiement — cas que Stripe qualifie lui-même d'« extrêmement rare » — **et** une livraison hors ordre. Mais quand il se produit, il produit précisément l'écran que la feature existe pour éviter.

---

## 7. Confirmations de sécurité opérationnelle

**Ce que j'ai fait** — exclusivement des lectures locales : `git diff` / `git log` / `git show` sur `main...HEAD`, lecture de fichiers du dépôt et de `node_modules` (types du SDK Stripe, `@vercel/functions`, `next/dist/docs` et `next/dist/server/after`), recherches `grep`. Deux commandes exécutées, toutes deux locales et en lecture : `bun run check && bun run test` (exit 0) et `bun run test:coverage` (exit 0, seuils tenus). Une recherche web sur la documentation publique Stripe, sans authentification ni appel d'API.

**Ce que je n'ai pas fait** — aucune ressource distante n'a été touchée : aucun appel à l'API Stripe (ni lecture ni écriture), aucun appel AWS, aucune branche Neon créée ou interrogée, aucune commande `vercel env`, aucun déploiement. `bun run test:integration` et `bun run test:coverage:full` n'ont pas été lancés, conformément à la consigne.

**Secrets** — aucun fichier `.env*` n'a été ouvert, lu ni imprimé. Le fichier `.env` ouvert dans l'IDE de l'utilisateur a été ignoré. Les seules mentions de variables d'environnement dans ce rapport sont leurs **noms**, lus dans `lib/env/schema.ts` et les scripts.

**Écritures** — un seul fichier créé, ce rapport. Aucun fichier source modifié, aucun commit, aucun `git add`.
