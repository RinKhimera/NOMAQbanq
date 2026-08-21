# Catalogue Stripe par `lookup_key` et traçabilité Adaptive Pricing

> Issue [#138](https://github.com/RinKhimera/NOMAQbanq/issues/138) — `enhancement`, `tech-debt`.
> Décisions de conception validées le 2026-08-21.

## Problème

Deux angles morts, tous deux invisibles au type-check comme aux tests.

**Le prix affiché et le prix facturé viennent de deux sources.** La grille tarifaire
et les paywalls lisent `products.priceCad` en Postgres ; Stripe facture ce que
désigne `products.stripePriceId`. Les tarifs étant gérés au dashboard Stripe, une
modification non répercutée par un `UPDATE` en base fait diverger les deux en
silence : **le client lit un montant et en paie un autre.**

**Rien en base ne dit ce que le client a réellement vu.** Adaptive Pricing est actif
en production. La doc officielle est explicite : « The Checkout Session and the
underlying `PaymentIntent` objects reflect what your customer paid in **your
integration currency and amount** ». Un client camerounais voit des FCFA mais
l'événement arrive en `currency: "cad"` ; le montant local vit dans
`presentment_details`, que l'app ignore. Un client qui écrit « j'ai payé
25 000 FCFA » n'est donc recoupable par personne.

S'y ajoute une classe de bug structurelle : `price_…` et `prod_…` portent des
préfixes **identiques en test et en live**. Un identifiant du mauvais mode ne se
révèle qu'à la création de la session, en `resource_missing`. C'est ce qui laisse
aujourd'hui 4 produits sur 5 intestables en local.

## Décision structurante

Le lien catalogue ↔ Stripe passe d'un **identifiant opaque, propre à un mode**, à
une **clé stable partagée par les deux modes** : `lookup_key`.

C'est le cas d'usage documenté par Stripe, mot pour mot : « Instead of hard-coding
text like 10 USD per month on your pricing page and using a price ID on your
backend, you can query for the price using the `standard_monthly` key »
(`https://docs.stripe.com/products-prices/manage-prices#lookup-keys`). Le
changement de tarif s'y fait par `transfer_lookup_key=true` — un prix n'est jamais
modifié, il est remplacé et la clé migre sur le nouveau.

Conséquence directe : la classe « identifiant du mauvais mode » devient
**impossible** au lieu d'être seulement détectée. Le point 4 de l'issue (catalogue
de dev à moitié en live) se dissout sans aucun `UPDATE` manuel — les 5 `lookup_key`
existent déjà des deux côtés, avec la même chaîne.

## Modèle de données

```
products
  - stripe_price_id           text NOT NULL     ← supprimée en phase 2
  + stripe_price_lookup_key   text NOT NULL     ← backfillée depuis `code`

transactions
  + presentment_amount        integer NULL      ← unité mineure de la devise présentée
  + presentment_currency      text NULL         ← texte libre, PAS l'enum `currency`
```

**`presentment_currency` est du texte, délibérément.** L'enum `currency` ne connaît
que `CAD` et `XAF` ; Adaptive Pricing couvre plus de 150 pays et peut présenter
n'importe quelle devise de marché supporté. Contraindre ici ferait perdre la donnée
qu'on cherche précisément à capturer.

**`amount_paid` / `currency` ne bougent pas.** Ils restent le chiffre
d'encaissement — c'est-à-dire le montant comptable. Aucune régression comptable
n'est acceptable (critère d'acceptation n°3 de l'issue).

**Une colonne dédiée plutôt qu'une dérivation depuis `code`.** Les `lookup_key`
Stripe portent aujourd'hui exactement la même chaîne que `products.code`, ce qui
rendait tentant un `prices.list({ lookup_keys: [product.code] })` sans colonne.
Écarté : le couplage entre l'enum Postgres et le nommage Stripe deviendrait
invisible dans le code, et un renommage d'un côté casserait l'autre sans signal.

## Checkout — résolution et détection de dérive

Dans `createStripeCheckout` (`features/payments/actions.ts`), le prix est résolu
avant la création de la session :

```
prices.list({ lookup_keys: [product.stripePriceLookupKey], active: true, limit: 2 })
  → 0 résultat  → Sentry + repli de phase 1 sur products.stripePriceId
  → 1 résultat  → line_items: [{ price: price.id, quantity: 1 }]
  → 2 résultats → Sentry (anomalie : la clé devrait être unique), on prend le premier
```

`limit: 2` n'a d'intérêt que si le second résultat est réellement lu : sinon une
clé portée par deux prix actifs se règlerait au hasard, en silence. La requête est
bornée à 8 s et un seul réessai — le SDK Stripe attend 80 s et réessaie 2 fois par
défaut, ce qui est inacceptable sur un chemin où l'utilisateur attend.

Le `Price` retourné porte `unit_amount` et `currency` : **la comparaison avec
`product.priceCad` ne coûte aucun appel supplémentaire.** Mais les deux champs ne
se traitent pas de la même façon.

**Un montant divergent alerte sans bloquer.** Chez Stripe, on ne modifie pas le
montant d'un prix : on en crée un autre et on lui transfère la clé
(`transfer_lookup_key`). Une divergence de montant est donc un état **transitoire
légitime** — le temps que l'`UPDATE` de `products.priceCad` suive. Couper les
ventes du produit pendant cette fenêtre coûterait plus cher que l'écart, d'autant
que Checkout affiche le montant au client **avant** qu'il ne confirme : il n'y a
pas de paiement à son insu, seulement une grille tarifaire périmée.

**Une devise ≠ `cad` refuse la vente.** La devise d'un prix Stripe est
**immuable** : elle ne peut pas avoir « changé » en attendant une mise à jour.
Une devise inattendue signifie que la clé pointe sur le mauvais prix — il n'existe
aucun scénario où continuer soit le bon choix.

**Pas de cache sur cette résolution au départ.** Stripe le suggère (« you might
want to add a caching layer to only reload the price occasionally ») et ce sera la
bonne réponse si la latence se mesure un jour. Mais c'est un appel de plus sur un
chemin qui appelle déjà Stripe pour créer la session, et un cache introduit sa
propre classe de bug : un prix périmé servi après correction. Différé, pas oublié.

## Cron — dérive sur les produits que personne n'achète

Nouvelle tâche `auditProductPriceDrift` dans `features/payments/cron.ts`, branchée
dans le dispatcher existant `app/api/cron/close-expired/route.ts`. Elle suit la
forme des 4 tâches en place : isolée par le helper `run()`, un échec ne bloque pas
les suivantes (notamment l'anonymisation RGPD).

La vérification au checkout ne voit que les produits qu'on achète. Un produit peu
demandé peut dériver des semaines sans que personne ne l'apprenne : le cron couvre
les 5 actifs.

**Découpage par paquets de 10.** Le paramètre `lookup_keys` accepte au maximum
10 clés par requête. À 5 produits actifs la contrainte ne mord pas, mais la tâche
doit découper — sinon elle casse en silence le jour où le catalogue grandit.

**La tâche ne fait jamais échouer le cron.** Le SDK Stripe attend 80 s et réessaie
2 fois par défaut ; l'appelant GitHub Actions coupe à `--max-time 60` et relance
sur erreur (`--retry 3 --retry-all-errors`). Un audit purement informatif qui
laisserait remonter une panne Stripe provoquerait donc jusqu'à **4 exécutions
complètes du cron par heure** — clôtures d'examens et notifications comprises. Deux
garde-fous : l'appel Stripe est borné (8 s, 1 réessai), et l'échec se signale par un
drapeau dans le compte-rendu plus une capture Sentry, jamais par une exception.

### Coût — mesuré, pas supposé

| Poste | Coût |
| --- | --- |
| Stripe | 1 requête `prices.list` par exécution. Le cron part 1×/h (GitHub, best-effort) + 1×/jour (Vercel, plancher) → **~25 requêtes/jour**. Limite documentée : 100 req/s en live, 25 req/s par endpoint. On est à 0,0003 req/s. Les appels API ne sont pas facturés. |
| Neon | 1 `SELECT` de 5 lignes sur index. **Aucune connexion nouvelle** : le dispatcher est séquentiel (invariant NOMAQBANQ-17), la tâche réutilise la connexion déjà ouverte par les tâches précédentes. Pas de réveil Neon supplémentaire. |
| Sentry | Le seul poste non nul. Voir ci-dessous. |

**Bruit Sentry — choix assumé.** Tant qu'une dérive n'est pas corrigée, la tâche
alerte à chaque exécution : jusqu'à ~25 événements/jour, groupés sur une seule
issue mais consommant le quota un par un. Un mécanisme anti-répétition (garde
horaire, état de dernière alerte) a été écarté : une dérive de prix est une erreur
d'ops qui se corrige le jour même, et l'anti-répétition ajouterait de l'état
persistant pour un problème qui ne dure pas. Si le bruit devient réel, la réponse
est de corriger la dérive, pas de baisser le volume de l'alarme.

## Fulfillment — persistance de `presentment_details`

Le webhook transmet `checkoutSession.presentment_details` à
`completeStripeTransaction`, qui écrit les deux colonnes dans le **même `UPDATE`**
que le reste du fulfillment — aucune écriture supplémentaire, aucun aller-retour.

Même règle que la réconciliation montant/devise déjà en place : **valeur absente ou
inexploitable → on n'écrit rien et on continue.** Un paiement valide ne doit jamais
échouer pour un problème de traçabilité.

La doc Adaptive Pricing énonce que le hash **est présent quand le client paie en
devise locale**. Elle n'énonce pas la réciproque — rien n'y garantit qu'il soit
toujours absent autrement. Le taux de lignes non nulles est donc une **borne
basse** de la proportion de clients passés par la conversion, pas une mesure
exacte, et il ne faut pas le présenter autrement dans un tableau de bord. La
première semaine de données tranchera : si des lignes non nulles apparaissent avec
`presentment_currency = 'CAD'`, la réciproque est fausse et le calcul doit exclure
les lignes où la devise présentée égale la devise d'encaissement.

Pour un client canadien, les deux colonnes sont attendues nulles. C'est le
comportement normal, pas une anomalie.

## Affichage admin

Dans `app/(admin)/admin/utilisateurs/_components/user-side-panel.tsx`, sous le
montant encaissé :

```
+50,00 $ CA
présenté : 228 000 XAF
```

La ligne n'apparaît que si `presentment_currency` est renseignée.

Nouveau helper `formatPresentmentAmount` dans `lib/format.ts`. Il ne peut pas
diviser par 100 en dur : la devise présentée est arbitraire et peut être
zéro-décimal (XAF, JPY), auquel cas 228 000 FCFA s'afficheraient en « 2 280 ». Le
nombre de décimales se dérive de `Intl.NumberFormat(...).resolvedOptions()`, ce qui
évite d'embarquer une liste de devises zéro-décimal qui vieillirait mal. Code ISO
inconnu d'`Intl` (qui lève `RangeError`) → repli sur `<montant> <DEVISE>`.

`formatCurrency` n'est pas touché : il est appelé partout ailleurs avec des cents.

## Déploiement — expand/contract obligatoire

Les migrations Drizzle tournent **au build Vercel, avant l'activation du
déploiement** (`build:vercel` → `migrate-deploy`). Un `DROP COLUMN
stripe_price_id` dans la même migration casserait le checkout de l'ancien code
pendant toute la durée du build — l'ancien `SELECT` référencerait une colonne
disparue. D'où deux temps :

1. **Ce PR** — `ADD COLUMN stripe_price_lookup_key` (nullable), `UPDATE products
   SET stripe_price_lookup_key = code`, puis `SET NOT NULL`. Le code bascule sur
   la résolution par `lookup_key`. `stripe_price_id` reste en base, plus lue par
   personne.
2. **PR de suivi, après vérification en production** — `DROP COLUMN
   stripe_price_id`.

Le backfill depuis `code` remplit dev **et** prod en une migration : plus aucun
`UPDATE` manuel, plus de produit intestable en local.

### Prérequis avant déploiement

Deux choses cassent le checkout si elles sont manquées.

**Les `lookup_key` doivent réellement exister, dans les deux modes.** Le backfill
remplace un pointeur éprouvé en production par un pointeur qui repose sur une
affirmation extérieure au dépôt (un commentaire d'issue du 2026-08-06). À
revérifier en lecture seule sur le compte, en test et en live, **avant** la
migration. D'où le repli décrit ci-dessous.

**La clé Stripe runtime doit avoir la permission de lecture sur Prices.** Créer une
session Checkout avec un price ID ne l'exigeait pas ; `prices.list` l'exige. Si
`STRIPE_SECRET_KEY` porte une clé restreinte (`rk_`), ajouter `prices:read` **avant**
le déploiement — sinon tous les checkouts tombent en `permission_error`. Une clé
secrète (`sk_`) a la permission par défaut.

### Repli de phase 1

Tant que `stripe_price_id` existe, une `lookup_key` qui ne résout rien **ne coupe
pas la vente** : le checkout retombe sur le pointeur historique et alerte. C'est
l'usage même de la colonne qu'on conserve pendant la fenêtre expand/contract — le
nouveau chemin est éprouvé en production avant que l'ancien ne soit retiré, et le
silence de l'alerte est ce qui autorise la phase 2. Le repli disparaît avec la
colonne : ensuite, une clé introuvable redevient un refus.

## Portée collatérale

- **Trois commentaires à corriger** (point 3 de l'issue), qui affirment aujourd'hui
  le contraire de la doc : `features/payments/stripe.ts` (bloc JSDoc de
  `completeStripeTransaction`), `app/api/stripe/webhook/route.ts` (« Montant/devise
  réellement facturés (promo, Adaptive Pricing) »),
  `scripts/audit-stripe-transactions.ts` (en-tête). **Seuls les codes promo** font
  effectivement diverger `amount_total` de `priceCad` ; la branche de conversion
  XAF ×100 reste correcte mais n'est jamais atteinte sous Adaptive Pricing.
- **`.claude/rules/payments.md`** — la section « Catalogue produits » décrit
  `stripePriceId` comme la source de facturation et les préfixes `price_` comme le
  piège de mode. Les deux deviennent faux : à réécrire autour du `lookup_key`.
- **`AGENTS.md`** — le gotcha « seul `exam_access` pointe sur un prix test »
  disparaît.
- **`ProductView`** (`features/payments/dal.ts`) — `stripePriceId` et
  `stripeProductId` traversent la frontière serveur → client alors qu'aucun
  composant ne les lit. Retirés au passage.
- **~20 fichiers de tests** insèrent `stripePriceId` dans des lignes `products` :
  renommage mécanique mais large.

## Tests

- **Unitaire** — résolution `lookup_key` (0 résultat → erreur « mal configuré » ;
  1 résultat → price ID passé aux `line_items`) ; détection de dérive sur le
  montant et sur la devise ; `formatPresentmentAmount` (XAF zéro-décimal, CAD,
  code ISO invalide).
- **Intégration `payments-checkout.test.ts`** — la session est créée avec le price
  ID résolu ; `lookup_key` introuvable → message dédié, aucune transaction
  `pending` créée.
- **Intégration `payments-stripe.test.ts`** — le fulfillment persiste
  `presentment_amount`/`presentment_currency` ; absence de `presentment_details` →
  colonnes nulles **et** `amountPaid`/`currency` inchangés.
- **Cron** — écart détecté → alerte émise, aucune écriture en base.

Écrire les tests par paires jumelles : un cas où la garde doit passer, un cas où
elle doit mordre. Un test qui passe que la vérification existe ou non ne teste rien.

## Hors périmètre

- **Aucun prix en XAF.** Adaptive Pricing exige que la devise des prix soit une
  devise de règlement du compte, et la conversion est désactivée pour toute devise
  déjà présente dans `currency_options`. Créer un prix XAF « pour aider » couperait
  la conversion automatique sur cette devise. Les six pays de la zone XAF sont tous
  dans les marchés supportés : la configuration actuelle est la bonne.
- **Pas de backfill de `presentment_details`** sur l'historique : la mesure commence
  aujourd'hui.
- **Pas d'affichage dans la table transactions admin ni dans l'historique client.**
- **Pas de blocage de vente sur un écart de MONTANT** (la devise, elle, refuse).
- **Pas de cache** sur la résolution du prix.

## Critères d'acceptation

| Critère de l'issue | Couverture |
| --- | --- |
| Écart `priceCad` ↔ prix Stripe détecté sans intervention manuelle | Checkout (au moment où ça compte) + cron (horaire best-effort, quotidien garanti) pour les produits non achetés |
| Montant et devise présentés persistés et consultables côté admin | Colonnes `presentment_*` + panneau utilisateur admin |
| `amountPaid` / `currency` restent le montant d'encaissement | Aucune modification du chemin de réconciliation ; test dédié |
| Les trois commentaires trompeurs corrigés | Portée collatérale |
| Les 5 produits achetables en mode test depuis la base dev | Dissous par le `lookup_key` : la clé de test résout le prix de test |

## Astuce de test

Pour voir Checkout en FCFA sans quitter le Québec, suffixer l'email du code pays :
`customer_email: "test+location_CM@example.com"`. Stripe présente alors la session
comme pour un client camerounais — et `presentment_details` apparaît sur
l'événement.
