# Paiements Stripe

Invariants du flux de paiement. Le code fait autorité sur le « comment » ;
ce fichier retient le « pourquoi », c'est-à-dire ce qu'on ne devine pas en le
lisant et dont la violation coûte de l'argent ou un accès non rendu.

## Octroi d'accès

- **Le webhook est le SEUL chemin d'octroi.** La page de succès
  (`verifyStripeCheckout`) ne fait qu'AFFICHER un statut — elle ne crédite
  jamais. Un utilisateur qui ferme l'onglet avant la redirection doit quand même
  recevoir son accès. Corollaire anti-IDOR : la session est refusée si
  `metadata.userId` ≠ utilisateur courant.
- **Idempotence sous verrou.** `completeStripeTransaction`
  (`features/payments/stripe.ts`) vérifie `stripeEventId` APRÈS avoir pris un
  `SELECT … FOR UPDATE` sur la ligne `user` ; l'index unique sur
  `stripe_event_id` n'est que le filet. Deux livraisons concurrentes du même
  événement — Stripe retente — ne créditent qu'une fois.
- **Paiements différés** : un virement complète la session en `unpaid` puis
  confirme par un second événement. `checkout.session.async_payment_succeeded`
  DOIT rester branché sur le même chemin d'octroi, sinon ces clients paient sans
  jamais recevoir l'accès.
- **Cumul du temps, sauf combo.** Un achat d'accès simple alors qu'un accès du
  même type est actif **prolonge** l'expiration (15 j restants + 30 j = 45 j).
  Un produit `isCombo` (`premium_access`) pose au contraire une fenêtre fraîche
  `now + durée` et octroie les DEUX types. L'expiration est recalculée au
  fulfillment, jamais reprise du `pending` (le `now` a avancé, l'accès existant
  a pu changer entre-temps).
- **Un admin court-circuite `hasAccess`** : aucun paiement requis pour lui.
  Tester un paywall depuis un compte admin ne prouve donc rien.

## Webhook — contrat de réponse

`400` signature absente/invalide (jamais rejoué) · `500` erreur inattendue →
Stripe **RÉESSAIE** · `200` traité ou volontairement ignoré. **Ne jamais
acquitter une erreur transitoire en 200** : le fulfillment serait perdu sans
trace. La route catche puis renvoie une `Response`, donc `onRequestError` ne
voit rien — le `captureServerError` explicite est la SEULE trace Sentry.

## Montants et devises

- **Tout est stocké en centièmes** (`amountPaid`), y compris le XAF. Or le XAF
  est une devise **zéro-décimal** (aucune sous-unité, comme le JPY) : un
  `amount_total` Stripe libellé en XAF est en francs entiers et doit être
  multiplié par 100 avant d'entrer en base.
- **Adaptive Pricing ne change PAS la devise de la session.** La doc officielle
  est explicite : « The Checkout Session and the underlying `PaymentIntent`
  objects reflect what your customer paid in **your integration currency and
  amount** ». Un client camerounais qui voit des FCFA produit malgré tout une
  session `currency: "cad"` ; le montant local vit dans `presentment_details`
  (`presentment_amount` / `presentment_currency`), que l'app ne persiste pas.
  Conséquence : la conversion XAF ci-dessus n'est atteinte que si un prix est
  RÉELLEMENT libellé en XAF (via `currency_options`), pas par Adaptive Pricing.
  Ne pas « corriger » ce qu'on croit être du XAF entrant sans vérifier lequel des
  deux mécanismes est en jeu.
- **La réconciliation ne doit jamais faire échouer un paiement valide.** Montant
  ou devise inexploitables → on conserve les valeurs provisoires et on logue.

## Catalogue produits

- **Le prix affiché et le prix facturé viennent de deux sources.**
  `products.priceCad` (Postgres) alimente la grille tarifaire et les paywalls ;
  `products.stripePriceId` détermine ce que Stripe facture réellement. Modifier
  un prix au dashboard Stripe SANS mettre à jour la ligne `products` fait
  diverger les deux en silence — le client voit un montant et en paie un autre.
- **Les préfixes `price_` / `prod_` sont identiques en test et en live.** Un
  identifiant du mauvais mode ne se voit qu'à la création de la session, en
  `resource_missing` — d'où le message dédié « produit mal configuré » plutôt
  qu'une erreur réseau générique. C'est le seul signal existant : le vérifier
  avant de conclure à une panne Stripe.
- **Adaptive Pricing exige que la devise des prix soit une devise de règlement**
  du compte. Les prix restent donc en CAD ; ne pas créer de prix en devise
  locale « pour aider », ça désactive la conversion automatique.
- Les prix, durées et libellés ne sont PAS en dur côté client (la grille lit
  `getAvailableProducts`). Seuls quelques **codes** le sont pour la mise en page
  (`pricing-grid.tsx` isole `premium_access`, la modale de paiement manuel a
  `exam_access` par défaut).
