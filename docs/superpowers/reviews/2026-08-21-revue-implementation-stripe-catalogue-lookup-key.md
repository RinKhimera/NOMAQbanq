# Revue adversariale d'implémentation — catalogue Stripe par `lookup_key`

**Date** : 2026-08-21
**Périmètre** : `git diff 54130ed..HEAD` (7 commits) sur `feat/stripe-catalogue-lookup-key`
— 38 fichiers, +3 628 / −45.
**Méthode** : lecture seule, posture hostile. Chaque constat est prouvé par une lecture
de code citée `fichier:ligne` ou par une commande rejouable. Chaque suspicion a subi une
tentative de réfutation ; celles qui n'ont pas survécu sont consignées en §4.
**Référentiel de non-régression** : `origin/main` (état avant la branche).

**État de la vérification**

| Commande                 | Résultat                                            |
| ------------------------ | --------------------------------------------------- |
| `bun run check`          | **exit 0** (prettier + tsc + eslint)                |
| `bun run test`           | **exit 0** — 117 fichiers, 1 330 tests, 0 échec     |
| `bun run test:integration` | **non lancé** — aucun constat n'en dépend (voir §7) |

---

## 1. Ce qui est solide (pour ne pas noyer le signal)

- **L'invariant comptable tient.** Le bloc `presentment` (`features/payments/stripe.ts:159-166`)
  est un objet séparé, étalé après `...(reconcile ?? {})` dans le même `tx.update`
  (`stripe.ts:167-177`) : il ne peut pas toucher `amountPaid`/`currency`. L'intégration
  l'assert explicitement (`tests/integration/payments-stripe.test.ts:180-183`).
- **L'idempotence est intacte.** L'écriture nouvelle est en aval du `FOR UPDATE`
  (`stripe.ts:80-85`), du contrôle `stripeEventId` (`stripe.ts:88-93`) et du contrôle
  `status === "completed"` (`stripe.ts:95-100`), dans la même transaction, en un seul UPDATE.
- **La migration est propre.** Expand-only, backfill avant le `SET NOT NULL`, rejouable
  à vide comme sur une base peuplée (§4.3), snapshot cohérent au bit près (§4.4).
- **Retirer `stripePriceId`/`stripeProductId` de `ProductView` est un gain de sécurité**,
  pas seulement du ménage : ces identifiants partaient dans la charge RSC de
  `/tarifs`, `/abonnements` et des paywalls. Aucun lecteur nulle part (§5.7).
- **La tâche cron ne lève jamais** et le dispatcher garde sa ceinture (`run()`), les deux
  testés (`tests/features/payments-cron.test.ts:142-149`,
  `tests/features/cron-close-expired.test.ts:110-121`).

---

## 2. Tableau des constats

| #   | Sév | fichier:ligne                                | Problème                                                                                                                                        | Régression ? |
| --- | --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| F1  | 🟠  | `features/payments/actions.ts:364-392`       | Le repli de phase 1 ne couvre que « la clé ne résout rien ». Si `prices.list` **lève** (clé restreinte sans `prices:read`, 429, réseau), l'exception saute par-dessus le repli → 100 % des checkouts échouent, avec un message qui invite à réessayer indéfiniment. | **OUI**      |
| F2  | 🟡  | `app/api/cron/close-expired/route.ts:93-106` | L'audit (informatif) est placé **avant** les notifications dans un dispatcher séquentiel dont l'appelant coupe à `--max-time 60` et relance tout. Jusqu'à ~16,5 s consommés aujourd'hui, ~80 s à 50 produits.                                                       | **OUI**      |
| F3  | 🟡  | `features/payments/cron.ts:60`               | `limit: 10` suppose 1 prix actif par clé — hypothèse que `catalog.ts:35` réfute explicitement. Troncature silencieuse → faux « aucun prix actif ». Et le cron retient le **dernier** prix d'une clé dupliquée là où le checkout prend le **premier**.                | NON          |
| F4  | 🟡  | `tests/features/stripe-webhook-errors.test.ts:145-151` | Le câblage webhook → `presentment_details` n'est couvert par rien, et l'assertion qui aurait dû le porter laisse passer les nouvelles clés (sémantique `toEqual` : `undefined` ≡ absent).                                                                | NON          |
| F5  | ℹ️  | `features/payments/actions.ts:400`           | Le prix de repli n'est comparé à rien (ni montant, ni devise) — le chemin nominal refuserait ce que le repli accepte. **Jugé acceptable**, argumenté en §5.1.                                                                                                       | NON          |
| F6  | ℹ️  | `features/payments/catalog.ts:31-35`         | `limit: 2` plafonne `count` : l'alerte Sentry dira toujours « 2 prix », même s'il y en a sept.                                                                                                                                                                       | NON          |
| F7  | ℹ️  | `app/api/stripe/webhook/route.ts:87-90`      | La forme du payload webhook dépend de la version d'API **de l'endpoint dashboard**, pas du SDK. Épinglé avant `2025-03-31.basil` → colonnes éternellement nulles, en silence, indistinguable de « personne ne convertit ».                                            | NON          |
| F8  | ℹ️  | `tests/features/payments-cron.test.ts:108-130` | Le test du découpage renvoie les 12 prix à chaque appel : il prouve « 2 appels », pas « le découpage évite la troncature ». Resterait vert avec `LOOKUP_KEYS_PER_CALL = 11`.                                                                                        | NON          |

---

## 3. Détail par constat

### F1 🟠 — Le repli de phase 1 ne rattrape que la moitié des façons dont la résolution peut échouer

**Code**

- `features/payments/actions.ts:364-373` — `await resolveStripePrice(...)`, sans `try` local.
- `features/payments/actions.ts:380-392` — le repli, conditionné à `if (!price)` : il ne
  s'exécute que si l'appel a **réussi** en renvoyant zéro prix.
- `features/payments/actions.ts:459-476` — le `catch` de la fonction : `resource_missing`
  → message dédié ; **tout le reste** → `captureServerError` sans `detail` puis
  `« Erreur lors de la création du paiement. Réessayez. »`.
- `features/payments/actions.ts:34-37` — `isStripeResourceMissing` est un duck-check sur
  `error.code === "resource_missing"` ; une `StripePermissionError` (HTTP 403, `type:
  "invalid_request_error"`, pas de `code`) ne matche pas.

**Pourquoi c'est un vrai bug.** `resolveStripePrice` peut échouer de trois façons, et le
repli n'en couvre qu'une :

| Mode d'échec                                  | Ce qui se passe                                            |
| --------------------------------------------- | ---------------------------------------------------------- |
| La clé ne résout aucun prix actif             | ✅ repli sur `stripePriceId`, vente conservée, Sentry alerte |
| La clé Stripe runtime n'a pas `prices:read`   | ❌ exception → **tous** les checkouts échouent, en permanence |
| 429 / coupure réseau sur `prices.list`        | ❌ exception → checkout perdu, l'utilisateur voit « Réessayez » |

Le cas médian n'est pas théorique : c'est le risque que le design nomme lui-même en
premier (`docs/…-design.md:230-234` — « sinon **tous** les checkouts tombent en
`permission_error` ») et que le plan traite par une case à cocher manuelle
(`docs/…plan.md:70`, non cochée dans le dépôt). Créer une session Checkout avec un price
ID n'exigeait pas ce droit ; `prices.list` si. Autrement dit, la branche introduit une
permission requise **nouvelle**, et l'échec correspondant est routé vers la branche la
moins utile du `catch` : un message qui invite à réessayer ce qui ne peut jamais aboutir,
et une capture Sentry **sans `detail`** — donc sans le nom du produit ni la `lookup_key`,
là où les deux autres captures les portent.

Le troisième cas est une pure perte de disponibilité : `origin/main` faisait **un seul**
appel Stripe dans `createStripeCheckout` (une écriture, `checkout.sessions.create`) ; la
branche en ajoute un second, en **lecture**, et le rend bloquant. On peut objecter qu'une
panne Stripe totale ferait de toute façon échouer la création de session — c'est vrai, et
c'est pourquoi ce constat n'est pas 🔴. Mais `prices.list` est un endpoint distinct :
une dégradation partielle ou un `permission_error` le frappe sans toucher
`checkout.sessions.create`, et dans ces cas-là la vente est perdue alors que le pointeur
historique, `stripe_price_id`, est encore en base, encore `NOT NULL`, encore éprouvé en
production. C'est exactement ce que la colonne est censée couvrir pendant la phase 1.

**Régression ? OUI.** Avant la branche, aucun de ces trois modes d'échec n'existait sur le
chemin du checkout.

**Comment je l'ai prouvé.**
`sed -n '355,480p' features/payments/actions.ts` → le `try` englobe la résolution, aucun
`catch` local ; le repli est bien sous `if (!price)` (ligne 380) et non dans un gestionnaire
d'erreur. `grep -n -A 4 "isStripeResourceMissing" features/payments/actions.ts` → le
duck-check ne porte que sur `resource_missing`. `grep -n "STRIPE_SECRET_KEY"
lib/env/schema.ts` → la clé est libre (`.optional()`), rien dans le dépôt ne contraint ni
n'atteste son type ni ses droits.

**Correctif suggéré** (trois lignes, retirées avec le `DROP COLUMN` de la phase 2) :

```ts
let price: Stripe.Price | null = null
try {
  price = await resolveStripePrice(stripe, product.stripePriceLookupKey, onAmbiguous)
} catch (error) {
  // Phase 1 : la résolution est le chemin neuf, `stripe_price_id` le chemin éprouvé.
  // Une lecture de prix indisponible ne doit pas coûter une vente.
  captureServerError("[createStripeCheckout]", error, {
    userId: session.user.id,
    detail: `résolution de ${product.stripePriceLookupKey} impossible — repli sur stripe_price_id (produit ${productCode})`,
  })
}
```

À défaut : **prouver dans la PR** que la clé `STRIPE_SECRET_KEY` de Vercel Production
porte `prices:read` (ou est une `sk_`). Le repli reste préférable — il rend le prérequis
non bloquant au lieu de le déplacer dans la mémoire de quelqu'un.

---

### F2 🟡 — Un audit informatif s'intercale devant les notifications dans un budget de 60 s

**Code**

- `app/api/cron/close-expired/route.ts:93-98` — `priceDrift` est exécuté…
- `app/api/cron/close-expired/route.ts:100-106` — …**juste avant** `sendPendingNotifications`.
- `.github/workflows/cron-hourly.yml:52-56` — `curl --retry 3 --retry-delay 10
  --retry-all-errors --max-time 60`.
- `features/payments/cron.ts:20` et `:36-47` — `LOOKUP_KEYS_PER_CALL = 10`, `.limit(50)`
  sur les produits → jusqu'à 5 appels séquentiels.
- `features/payments/catalog.ts:12` / `features/payments/cron.ts:64` — `timeout: 8000,
  maxNetworkRetries: 1`.

**Pourquoi c'est un vrai bug.** Le dispatcher est séquentiel **volontairement** (commentaire
`route.ts:42-46`, Sentry NOMAQBANQ-17) : chaque tâche consomme le budget de la suivante.
Un `prices.list` qui traîne coûte `8 000 ms` + un retry avec backoff (~500 ms initial,
`node_modules/stripe/esm/stripe.core.js:96,168` pour les valeurs par défaut ré-écrasées)
≈ **16,5 s** — avec 5 produits, donc un seul lot. Si le catalogue atteint la borne
`.limit(50)`, ce sont 5 lots, soit jusqu'à **~80 s**, plus que le budget entier de
l'appelant. Ce temps est prélevé **avant** l'envoi des e-mails de résultats d'examen et
de rappel d'accès, c'est-à-dire avant la seule tâche du cron que des utilisateurs
attendent. Dépassement du `--max-time` → `curl` abandonne et rejoue **tout** le cron
(jusqu'à 4 exécutions), ce que le commentaire de `features/payments/cron.ts:29-34`
identifie précisément comme le scénario à éviter — et que ce placement rend plus probable.

**Régression ? OUI**, au sens du budget : avant la branche, les 60 s étaient intégralement
consacrées aux tâches utiles. Nuance honnête : la fonction serveur continue de tourner
après l'abandon du client, donc les notifications ne sont pas *perdues* — elles sont
retardées et le cron est rejoué.

**Comment je l'ai prouvé.** `cat -n app/api/cron/close-expired/route.ts` (ordre des `run()`),
`cat -n .github/workflows/cron-hourly.yml` (les chiffres du commentaire sont exacts —
vérifiés, pas crus), `grep -n "DEFAULT_TIMEOUT\|maxNetworkRetries" node_modules/stripe/esm/stripe.core.js`
(80 000 ms / 2 retries par défaut : le commentaire dit vrai).

**Correctif suggéré.** Déplacer le bloc `priceDrift` **après** `sendPendingNotifications`.
Un audit qui tourne 24×/jour n'a aucune raison de passer avant un e-mail. Une ligne.

---

### F3 🟡 — Le cron suppose une bijection clé → prix que le checkout, lui, refuse de supposer

**Code**

- `features/payments/cron.ts:53-61` — lots de 10 clés, `limit: LOOKUP_KEYS_PER_CALL` (=10).
- `features/payments/cron.ts:66-68` — `byLookupKey.set(price.lookup_key, price)` : le
  **dernier** gagne ; `has_more` est ignoré.
- `features/payments/catalog.ts:31-36` — le checkout demande `limit: 2` **précisément pour
  détecter** plusieurs prix actifs sous une même clé, et renvoie `data[0]` : le **premier**.

**Pourquoi c'est un vrai bug.** Les deux garde-fous sont censés dire la même chose du même
catalogue, et ils partent d'hypothèses contradictoires. Si une seule clé d'un lot porte
deux prix actifs — l'anomalie que `resolveStripePrice` alerte explicitement — le lot rend
11 prix pour `limit: 10` : la liste est tronquée, un produit se retrouve sans entrée dans
`byLookupKey`, et le cron émet une alerte **fausse** « aucun prix actif pour cette
lookup_key » (`cron.ts:81-88`). Pire pendant un `transfer_lookup_key` mal terminé : le
cron audite le dernier prix renvoyé, le checkout facture le premier — les deux peuvent
diverger sans que rien ne le signale. `limit` accepte 1 à 100 chez Stripe
(`node_modules/stripe/esm/resources/Prices.d.ts:714`), la borne de 10 ne concerne que
`lookup_keys` (`:667`) : rien n'oblige à les aligner.

**Régression ? NON** — code entièrement nouveau.

**Comment je l'ai prouvé.** `grep -n -B 6 "lookup_keys" node_modules/stripe/esm/resources/Prices.d.ts`
(« up to 10 lookup_keys ») et `:712-716` (« limit can range between 1 and 100 ») ;
lecture croisée de `cron.ts:53-68` et `catalog.ts:31-36`.

**Correctif suggéré.** `limit: 100` sur l'appel du cron (la borne de 10 s'applique aux
clés, pas aux résultats), et signaler une collision plutôt que l'écraser :

```ts
for (const price of data) {
  if (!price.lookup_key) continue
  if (byLookupKey.has(price.lookup_key)) { /* même alerte « plusieurs prix actifs » */ }
  else byLookupKey.set(price.lookup_key, price)
}
```

---

### F4 🟡 — Le seul câblage non testé est celui qui transporte la nouvelle donnée, et le test existant l'absorbe en silence

**Code**

- `app/api/stripe/webhook/route.ts:86-90` — les deux champs passés à
  `completeStripeTransaction`.
- `tests/features/stripe-webhook-errors.test.ts:129-151` — l'unique assertion sur la forme
  exacte de l'appel : `toHaveBeenCalledWith({ stripeSessionId, stripePaymentIntentId,
  stripeEventId, amountTotal, currency })` — sans les deux nouvelles clés.

**Pourquoi c'est un vrai bug.** L'appel réel passe désormais `presentmentAmount: undefined,
presentmentCurrency: undefined` (le mock de l'événement n'a pas de `presentment_details`).
`toHaveBeenCalledWith` compare avec la sémantique de `toEqual`, qui traite une propriété
`undefined` comme absente : le test reste **vert** en ignorant les deux clés. Il ne
« couvre » donc pas le câblage, il le masque. Et aucun autre test ne le couvre : le DAL
est testé en intégration (`tests/integration/payments-stripe.test.ts:154-183`) en appelant
`completeStripeTransaction` **directement**, ce qui saute exactement le morceau ajouté par
la Task 5 Step 4. Le typage rattrape une faute de frappe sur un nom de champ Stripe ; il
ne rattrape pas un mauvais champ correctement typé (`amount_total` au lieu de
`presentment_amount`, par exemple — deux `number`).

**Régression ? NON** — trou de couverture sur du code neuf.

**Comment je l'ai prouvé.** `sed -n '129,151p' tests/features/stripe-webhook-errors.test.ts`
comparé à `sed -n '73,91p' app/api/stripe/webhook/route.ts` ; `bun run test` passe
(1 330/1 330) alors que l'objet attendu ne mentionne pas les clés effectivement passées.

**Correctif suggéré.** Un cas de plus dans le fichier qui existe déjà — l'endroit exact que
la question ouverte n°8 désignait :

```ts
it("presentment_details → transmis au fulfillment", async () => {
  mocks.constructEventAsync.mockResolvedValueOnce({
    id: "evt_present", type: "checkout.session.completed",
    data: { object: { id: "cs_p", payment_status: "paid", payment_intent: "pi_p",
      amount_total: 5000, currency: "cad",
      presentment_details: { presentment_amount: 2280000, presentment_currency: "xaf" } } },
  })
  await POST(request())
  expect(mocks.completeStripeTransaction).toHaveBeenCalledWith(
    expect.objectContaining({ presentmentAmount: 2280000, presentmentCurrency: "xaf" }),
  )
})
```

---

### F5 ℹ️ — Le prix de repli n'est validé par rien (constat conservé, mais jugé acceptable)

**Code** : `features/payments/actions.ts:400` — `const drift = price ?
describePriceDrift(product.priceCad, price) : null`. Quand `price` est `null`,
`resolvedPriceId` vaut `product.stripePriceId` (`:392`) et part en `line_items` (`:424`)
sans qu'aucune devise ni aucun montant n'ait été comparé.

**Pourquoi ce n'est pas un défaut à corriger.** Valider le prix de repli exigerait un
`prices.retrieve(product.stripePriceId)` — donc **la permission `prices:read`**, c'est-à-dire
précisément le droit dont l'absence est l'une des causes plausibles du repli (F1). Le
contrôle s'auto-annulerait dans le cas qu'il prétend couvrir, au prix d'un troisième
aller-retour Stripe sur un chemin où l'utilisateur attend. Par ailleurs le repli ne se
déclenche jamais silencieusement : il est toujours précédé d'une alerte Sentry (`:381-390`),
et la règle projet fait du silence de cette alerte la condition du `DROP COLUMN`
(`.claude/rules/payments.md`). Le risque résiduel — un `stripe_price_id` périmé **et** en
mauvaise devise **et** une `lookup_key` absente, simultanément — est plus petit que le
coût du contrôle. **Laisser tel quel**, en documentant ce raisonnement dans le commentaire
du repli.

---

### F6 ℹ️ — L'alerte d'ambiguïté ne peut pas dire la vérité sur le nombre

`features/payments/catalog.ts:31-35` : `limit: 2` puis `onAmbiguous(lookupKey, data.length)`.
`data.length` est borné à 2 par la requête, donc le détail Sentry
(`actions.ts:371`, `` `${lookupKey} · ${count} prix` ``) affichera **toujours** « 2 prix ».
En incident, ça se lit comme « exactement deux », alors que ça signifie « au moins deux ».
Correctif : `` `${lookupKey} · au moins ${count} prix actifs` ``.

---

### F7 ℹ️ — La persistance dépend d'une version d'API qui ne se lit pas dans le dépôt

`presentment_details` apparaît dans l'API Stripe en `2025-03-31.basil`
(`node_modules/stripe/CHANGELOG.md:869` pour la version, `:922` pour l'ajout du champ). Le
code épingle `2026-07-29.dahlia` (`lib/stripe-api-version.ts:17`), largement postérieur —
côté SDK, tout va bien. **Mais** la charge utile d'un webhook est sérialisée dans la
version d'API de l'**endpoint** configuré au dashboard, pas dans celle du SDK :
`constructEventAsync` (`app/api/stripe/webhook/route.ts:48`) ne fait que vérifier une
signature sur le corps brut reçu. Si l'endpoint est épinglé avant `basil`,
`checkoutSession.presentment_details` est `undefined` en permanence, la garde
`params.presentmentAmount != null` (`stripe.ts:160`) n'écrit jamais rien, et les colonnes
restent nulles **sans une seule alerte** — indistinguable, par construction, de « aucun
client ne convertit », puisque `.claude/rules/payments.md` pose déjà le taux de non-nuls
comme une borne basse. À vérifier au dashboard avant/après le déploiement (je n'y ai pas
touché : §7). Un contrôle post-déploiement possible : une transaction connue payée en
devise locale doit ressortir avec `presentment_amount` non nul.

---

### F8 ℹ️ — Le test du découpage prouve le découpage, pas ce qu'il protège

`tests/features/payments-cron.test.ts:114-124` : le mock renvoie les **12** prix à chaque
appel, quel que soit le lot demandé. Le vrai Stripe n'en renverrait que les 10 réclamés.
Le test assert `toHaveBeenCalledTimes(2)` — vrai aussi si `LOOKUP_KEYS_PER_CALL` valait 11,
donc il ne mord pas sur la borne de l'API qu'il prétend défendre (commentaire `:105-107`).
Correctif : filtrer le mock sur les `lookup_keys` réellement demandées, et asserter
`drifted: 0` — ce qui échouerait alors si le lot dépassait 10.

---

## 4. Faux positifs écartés

1. **`formatCurrency` local → partagé casserait l'affichage du panneau admin.**
   Écarté. L'ancien formateur (`user-side-panel.tsx`, supprimé au diff) utilisait
   `{ minimumFractionDigits: 0, maximumFractionDigits: currency === "XAF" ? 0 : 2 }` ; le
   partagé (`lib/format.ts:31-53`) applique exactement `min 0 / max 2` en CAD, et rend le
   XAF en décimal suffixé `" XAF"` — sortie équivalente à un `style: "currency"` fr-CA.
   Aucune différence visible.

2. **`resolvedPriceId` (`let` hors du `try`) partagerait de l'état entre invocations
   concurrentes de la Server Action.** Écarté. `features/payments/actions.ts:359` : la
   déclaration est **dans** le corps de `createStripeCheckout`, pas au niveau module —
   une liaison par appel. Le `catch` ne peut pas non plus le lire dans un état trompeur :
   il vaut `null` tant que la résolution n'a pas abouti (message « prix non résolu »), et
   l'identifiant réellement envoyé ensuite.

3. **La migration casserait le déploiement de production.** Écarté. `ADD COLUMN` nullable →
   `UPDATE … = code::text` → `SET NOT NULL` (`drizzle/0013_sharp_gwen_stacy.sql:6-8`) :
   sur base vierge la table est vide (UPDATE 0 ligne, `SET NOT NULL` passe), sur base
   peuplée le backfill précède. Les deux colonnes `transactions` sont nullables sans
   défaut → métadonnée seule en PG 11+. Et rien n'insère de `products` à l'exécution :
   `grep -rn "insert(products)"` ne rend que des tests, `app/api/e2e/route.ts:258-260`
   ne fait qu'un `select`. Phase expand pure : l'ancien code cohabite sans rien voir.

4. **Le SQL écrit à la main aurait divergé de `drizzle/meta/`.** Écarté. Diff structurel
   profond `0012_snapshot.json` ↔ `0013_snapshot.json` : **exactement 12 différences**,
   toutes des attributs des trois colonnes attendues, aucune autre table touchée ;
   `prevId` de 0013 = `id` de 0012 ; `_journal.json` idx 13 cohérent.

5. **Le `sed` de la Task 1 aurait injecté `stripePriceLookupKey` dans un objet qui n'est
   pas un insert `products`.** Écarté. 22 occurrences dans l'arbre, 22 dans le diff, aucune
   ailleurs ; chacune suit immédiatement un `stripePriceId` à l'intérieur d'un
   `db.insert(products).values(...)`. La 22ᵉ est la forme mockée de la table
   (`tests/features/payments-cron.test.ts:35`), légitime. Le décompte « 21 » du brief est
   inexact d'une unité — sans conséquence.

6. **Retirer `stripePriceId`/`stripeProductId` de `ProductView` casserait un composant.**
   Écarté. `grep -rn "stripePriceId\|stripeProductId"` sur `app components features hooks
   e2e scripts tests lib db` : les seules occurrences hors tests/schéma sont
   `features/payments/actions.ts:342` et `:392`, côté serveur. Les 14 consommateurs de
   `ProductView` ne lisent que `code/name/priceCad/durationDays/accessType/isCombo`.

7. **Les colonnes `presentment_*` pourraient contaminer l'encaissement.** Écarté (voir §1).

8. **La nouvelle écriture casserait l'idempotence.** Écarté (voir §1) — même transaction,
   même UPDATE, en aval des deux gardes sous verrou.

9. **`presentment_currency` en texte libre serait exploitable dans le panneau admin.**
   Écarté. La valeur vient de Stripe, React échappe le rendu (`user-side-panel.tsx:216-223`),
   et `formatPresentmentAmount` a un `catch` (`lib/format.ts:78-80`). Aucune concaténation
   HTML, aucun `dangerouslySetInnerHTML`.

10. **Le seuil de couverture à 80 % serait menacé par la branche JSX non testée.** Écarté.
    `vitest.config.ts:39-45` : la couverture ne `include` que `lib/**`, `hooks/**`,
    `components/**`, `schemas/**`, `email/**` — ni `app/**` ni `features/**`. Le seul
    ajout comptabilisé, `formatPresentmentAmount`, est testé (`tests/lib/format.test.ts:96-116`).

11. **Le garde `if (!env.STRIPE_SECRET_KEY)` du cron serait du code mort.** Écarté :
    `lib/env/schema.ts:43` — `z.string().optional()`.

12. **Appel au `db` global dans une `db.transaction` (pool `max: 5`).** Écarté. Le `select`
    du cron (`features/payments/cron.ts:39-47`) est hors transaction ; le fulfillment
    n'utilise que `tx`.

---

## 5. Réponses aux questions ouvertes

**1. Le repli court-circuite toute validation de prix — trou réel ou conséquence acceptable ?**
**Acceptable, et à documenter comme tel** — mais pour une raison plus forte que celle
avancée. Valider le prix de repli imposerait un `prices.retrieve`, donc `prices:read`,
c'est-à-dire le droit dont l'absence est justement une cause plausible du repli : le
contrôle serait absent exactement quand il servirait. Ajoutez qu'il coûterait un troisième
aller-retour Stripe sur le chemin où l'utilisateur attend, et que le repli est toujours
précédé d'une alerte Sentry. Voir F5. **En revanche, le vrai trou du repli est ailleurs** :
il ne se déclenche pas quand l'appel *échoue*. C'est F1, et celui-là est à corriger.

**2. `resolvedPriceId` — état partagé entre invocations concurrentes ?**
**Non.** `actions.ts:359` : `let` dans le corps de la fonction, une liaison par appel ;
aucun état de module. Le `catch` ne le lit jamais dans un état trompeur — `null` avant
résolution (« prix non résolu »), l'identifiant effectivement envoyé après. Le seul
reproche possible est stylistique. **Rien à changer.**

**3. `checked: 0` quand Stripe échoue — ambigu en incident ?**
**Non, pas assez pour induire en erreur** : `failed` est le discriminant, il est dans le
JSON du cron (`route.ts:132`) et vaut `true` uniquement dans ce cas
(`features/payments/cron.ts:74`) ; le nombre de lignes réellement lues survit d'ailleurs
dans le `detail` Sentry (`cron.ts:71-73`). Reste que `{checked: 0, drifted: 0, failed: false}`
recouvre deux situations (Stripe non configuré / aucun produit actif), toutes deux bénignes.
Si vous voulez lever le doute pour zéro risque : renvoyer `checked: rows.length` même en
échec, ou ajouter `read: rows.length`. **Amélioration cosmétique, pas un correctif.**

**4. `presentmentCurrency` sans validation de format — exploitable ?**
**Non, seulement inélégant.** La valeur vient de Stripe (jamais d'une entrée utilisateur),
n'est lue que par un panneau admin gardé, et est rendue comme texte par React. `Intl` ne
lève que si le code n'est pas trois lettres ASCII — un code bien formé mais inconnu ne
lève **pas** et se voit divisé par 100 par défaut (fait déjà établi par la revue de design,
§F11). Conséquence pratique nulle ici : Stripe n'émet que des codes ISO réels. Le `catch`
de `lib/format.ts:78-80` couvre le reste. **Ne rien changer.**

**5. `presentment_amount` à 0 (promo 100 % en devise locale) — voulu ?**
**Oui, et c'est le bon comportement.** Le type Stripe rend `presentment_amount` obligatoire
dès que l'objet existe (`node_modules/stripe/esm/resources/Checkout/Sessions.d.ts:624-633`) :
les deux champs arrivent donc toujours ensemble, et un 0 signifie littéralement « le client
a vu 0 dans sa devise » — une information réelle, pas une absence. La distinction « pas de
conversion » vs « converti à zéro » est déjà portée par la nullité de la **paire** :
`stripe.ts:159-166` n'écrit que si `presentmentAmount != null` **et** `presentmentCurrency`
truthy. Un `!== undefined` aurait été plus littéral, mais `!= null` donne le même résultat
ici. **Ne rien changer.**

**6. Le `sed` a-t-il pollué un objet qui n'est pas un insert `products` ?**
**Non.** 22 occurrences (le brief en annonce 21), 16 fichiers, toutes vérifiées une par
une : 21 dans des `db.insert(products).values(...)`, la 22ᵉ dans la forme mockée de la
table du test unitaire du cron. Détail à savoir, sans gravité : les valeurs injectées sont
`` `price_${suffix}` ``, c'est-à-dire des **formes de price ID employées comme lookup_key**.
En intégration rien n'appelle Stripe, donc c'est inoffensif — mais c'est un contre-exemple
au message même de la branche (« une `lookup_key` n'est pas un `price_…` »). Cosmétique.

**7. `stripePriceId`/`stripeProductId` retirés de `ProductView` — vraiment aucun lecteur ?**
**Confirmé sur tout l'arbre**, pas seulement sur `app/ components/ features/ hooks/` :
grep étendu à `e2e/`, `scripts/`, `tests/`, `lib/`, `db/` — zéro lecteur. Mieux : la
suppression est un **gain de sécurité** non revendiqué par les commits. `ProductView` est
consommé par 14 composants clients (`pricing-grid.tsx`, `tarifs-page-client.tsx`,
`abonnements-client.tsx`, `training-paywall.tsx`, `manual-payment-modal.tsx`…) : ces deux
identifiants Stripe partaient donc dans la charge RSC visible au navigateur. **Bon
changement, à garder.**

**8. Le câblage webhook → fulfillment n'a aucun test — trou qui compte ?**
**Oui**, et c'est F4. Il compte d'autant plus que le test qui aurait dû l'attraper
(`stripe-webhook-errors.test.ts:145-151`) l'**absorbe silencieusement** : la sémantique
`toEqual` de `toHaveBeenCalledWith` traite `undefined` comme absent, si bien que l'ajout
des deux clés n'a même pas fait broncher l'assertion. Le DAL est couvert en intégration,
mais en appelant `completeStripeTransaction` directement — donc en sautant exactement le
morceau ajouté par la Task 5 Step 4. Un cas de dix lignes dans le fichier existant ferme
le trou.

---

## 6. Verdict

### Cette implémentation peut-elle partir en PR vers `main` telle quelle ? — **NON**

Le travail est d'excellente facture : l'invariant comptable, l'idempotence et la migration
résistent à une lecture hostile, les tests par paires (concordant / divergent) mordent
réellement, et la revue de design a bien été absorbée (le repli F2 réclamé y est). Un seul
point bloque, et il bloque parce que **merger dans `main` déploie en production** :
`vercel.json` fait tourner `build:vercel` → `scripts/migrate-deploy.ts`, qui applique les
migrations sur la base de production dès que `VERCEL_ENV === "production"`.

**Point bloquant unique — F1.** La branche crée une dépendance nouvelle à la permission
`prices:read` et route son échec vers la pire branche du `catch` (« Réessayez » pour une
panne permanente, capture Sentry sans `detail`). Deux issues acceptables, au choix :
soit les trois lignes de `try/catch` autour de `resolveStripePrice` (recommandé — le
prérequis cesse d'être une case à cocher dans la tête de quelqu'un), soit une preuve dans
la PR que la clé `STRIPE_SECRET_KEY` de Vercel Production est une `sk_` ou porte
`prices:read`.

Rien d'autre ne justifie de retenir la PR. F2 et F3 sont des correctifs d'une à trois
lignes qu'il serait dommage de reporter tant qu'on est dans le fichier ; F4 est un test.

### Correctifs priorisés

| Priorité                    | #      | Correctif                                                                                              | Coût     |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------- | -------- |
| **Bloquant — avant merge**  | **F1** | `try/catch` autour de `resolveStripePrice` → repli sur `stripePriceId` + Sentry avec `detail`. OU preuve documentée que la clé runtime porte `prices:read`. | 3 lignes |
| Avant le déploiement        | F2     | Déplacer `priceDrift` **après** `sendPendingNotifications` dans le dispatcher.                          | 1 ligne  |
| Avant le déploiement        | F3     | `limit: 100` sur `prices.list` du cron ; signaler les collisions de clé au lieu de les écraser.         | 4 lignes |
| Avant le déploiement        | F7     | Vérifier au dashboard que la version d'API de l'endpoint webhook ≥ `2025-03-31.basil`, puis contrôler après déploiement qu'une transaction convertie ressort avec `presentment_amount` non nul. | 5 min, hors dépôt |
| Souhaitable (même PR)       | F4     | Cas de test `presentment_details` dans `tests/features/stripe-webhook-errors.test.ts`.                  | 10 lignes |
| Cosmétique                  | F5     | Documenter dans le commentaire du repli **pourquoi** on ne valide pas le prix de repli (auto-annulation du contrôle). | 2 lignes |
| Cosmétique                  | F6     | « au moins N prix actifs » dans le détail Sentry d'ambiguïté.                                           | 1 ligne  |
| Cosmétique                  | F8     | Filtrer le mock du test de découpage sur les clés demandées.                                            | 5 lignes |

---

## 7. Confirmations de sécurité opérationnelle

- **Lecture seule respectée.** Aucun fichier source modifié. Le seul fichier écrit est le
  présent rapport. Aucun commit, aucun `git add`, aucune opération destructive.
- **Base de données de production : intacte.** Aucune connexion, aucune requête, aucune
  migration exécutée. `bun run test:integration` **n'a pas été lancé** (il crée et détruit
  une branche Neon éphémère) : aucun constat n'en dépendait — la validité des inserts de
  test est déjà garantie par le type-check (`bun run check` exit 0), qui exige la colonne
  `NOT NULL` sur chaque `db.insert(products)`.
- **Compte Stripe : intact.** Aucun appel API, aucun objet créé ni lu, ni en mode test ni
  en mode live. Toutes les affirmations sur le comportement de l'API Stripe sont tirées du
  SDK installé (`node_modules/stripe/`, v22.4.0) : types, CHANGELOG et valeurs par défaut.
  Corollaire assumé : je **ne peux pas** confirmer que les cinq `lookup_key` existent
  réellement en live, ni les droits de la clé runtime, ni la version d'API de l'endpoint
  webhook (F1, F7) — ces trois points restent à vérifier hors dépôt.
- **Secrets : jamais lus ni imprimés.** `.env.local` n'a été ni ouvert ni grepé ; aucune
  valeur de clé n'apparaît dans ce rapport. Les seules références à `STRIPE_SECRET_KEY`
  portent sur son schéma de validation (`lib/env/schema.ts:43`).
- **Aucun serveur de développement lancé.** Seules commandes exécutées : `git diff` /
  `git log`, lectures de fichiers, `grep`, `bun run check`, `bun run test`, et un `node -e`
  local comparant deux snapshots JSON du dépôt.
