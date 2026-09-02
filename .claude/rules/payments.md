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

## Litiges et confirmation d'achat

- **L'accès n'est jamais révoqué sur litige**, délibérément : couper l'accès
  affaiblirait la position « service livré et utilisé ». Le webhook alerte
  Sentry AVANT d'écrire en base (une panne Neon ne doit pas priver l'alerte
  de son détail), puis persiste `stripe_dispute_id` / `dispute_status` via
  `recordStripeDispute` ; la décision de contester reste humaine.
- **Un litige peut précéder le fulfillment.** Stripe livre
  `charge.dispute.created` AVANT `checkout.session.completed` avec la carte de
  test 0259, et un paiement différé peut être contesté avant confirmation : la
  transaction est alors `pending`, sans `payment_intent`. Sur `not_found`, le
  webhook résout la session Checkout (`checkout.sessions.list({ payment_intent })`)
  et rattache par `stripe_session_id`, connu dès le pending.
- **Ordre des événements de litige non garanti, et plusieurs litiges par
  paiement possibles.** Un statut terminal (`won`, `lost`, `warning_closed`,
  `prevented`) n'est jamais écrasé par un non-terminal DU MÊME litige ; un
  litige d'id différent remplace toujours le précédent, même clos. Ne pas
  « simplifier » l'UPDATE conditionnel.
- **`radar.early_fraud_warning.created` est un signal AVANT litige** : Stripe
  indique que 80 % deviennent un litige si rien n'est fait. L'alerte propose le
  remboursement proactif, qui évite les frais (15 $ + 15 $ CA) et le coup au
  taux de litige. C'est la seule mesure qui couvre un paiement Link pur, que
  `request_three_d_secure` (carte uniquement) ne protège pas.
- **Le courriel de confirmation part APRÈS le 200** (`waitUntil`) et en
  best-effort : Stripe exige une réponse rapide, et un retry retomberait en
  `already_processed` sans courriel ni trace. Un échec est capturé dans
  Sentry ; le reçu Stripe (`payment_intent_data.receipt_email`) part de son
  côté, donc le client n'est jamais sans trace. Le `MessageId` SES est stocké
  (`confirmation_email_message_id`) : clé de corrélation avec le journal SES.
  Compte anonymisé → aucun envoi (TLD `.invalid`, hard bounce).
- **Journal SES** : configuration set `nomaqbanq-transactional` → destination
  EventBridge → règle `nomaqbanq-ses-events` → CloudWatch Logs
  `/aws/events/nomaqbanq-ses` (rétention 400 j, métadonnées seulement, jamais
  le corps). C'est la seule preuve d'envoi a posteriori.
- **`consent_collection.terms_of_service: "required"` exige l'URL des CGU dans
  les informations publiques du compte Stripe**, sinon la création de session
  échoue (réglage partagé test/live) ; `createStripeCheckout` reconnaît ce cas
  par le `param` de l'erreur et alerte en nommant la cause.
- **Preuves de litige** : `bun run dispute:evidence <pi_…>` (lecture seule,
  env `AUDIT_DATABASE_URL` + `AUDIT_STRIPE_KEY` optionnelle) produit le journal
  d'activité au format des champs Stripe pour un produit numérique, et distingue
  un paiement carte d'un paiement Link.

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
- **`presentment_details` est persisté** (`transactions.presentment_amount` /
  `presentment_currency`, nullables, devise en texte libre — la conversion couvre
  plus de 150 pays, l'enum `currency` n'en connaît que deux). C'est la seule façon
  de recouper un client qui écrit « j'ai payé 228 000 FCFA ». Ces colonnes ne sont
  PAS comptables : `amountPaid`/`currency` restent l'encaissement. Le hash n'est
  présent que si le client a payé en devise locale — la doc n'énonce pas la
  réciproque, donc le taux de lignes non nulles est une BORNE BASSE de la
  proportion de conversions, pas une mesure exacte.

## Catalogue produits

- **Le prix affiché et le prix facturé viennent de deux sources.**
  `products.priceCad` (Postgres) alimente la grille tarifaire et les paywalls ;
  Stripe facture le prix résolu au checkout depuis
  `products.stripePriceLookupKey`. Modifier un prix au dashboard Stripe SANS
  mettre à jour la ligne `products` fait diverger les deux. Deux garde-fous
  alertent dans Sentry : la comparaison au checkout et la tâche cron
  `auditProductPriceDrift` (qui couvre les produits que personne n'achète).
- **Devise et montant ne se traitent PAS pareil dans cette comparaison.** La
  devise d'un prix Stripe est immuable (on ne modifie pas un prix, on en crée un
  autre et on lui transfère la clé) : une devise ≠ `cad` n'est jamais un état
  transitoire légitime → la vente est REFUSÉE. Un montant, lui, diverge
  normalement le temps que l'`UPDATE` de `priceCad` suive → on alerte SANS
  bloquer. Couper les ventes sur un écart de montant coûte plus cher que l'écart,
  d'autant que Checkout affiche le montant au client avant qu'il ne confirme.
- **Une `lookup_key` est identique en test et en live**, contrairement aux
  identifiants `price_…` / `prod_…` dont les préfixes n'encodent pas le mode.
  C'est ce qui rend impossible la classe « identifiant du mauvais mode » : la clé
  résout le prix de test sous une clé de test, le prix live sous une clé live.
  Changer un tarif se fait par `transfer_lookup_key=true`.
- **Repli transitoire (phase expand/contract)** : tant que `stripe_price_id`
  existe, une `lookup_key` qui ne résout rien retombe dessus et alerte, au lieu
  de couper la vente. Le silence de cette alerte en production est ce qui
  autorise le `DROP COLUMN` — après quoi une clé introuvable redevient un refus.
- **La résolution du prix exige `prices:read` sur la clé Stripe runtime.** Créer
  une session avec un price ID ne le demandait pas ; `prices.list` si. Une clé
  restreinte sans ce droit casse TOUS les checkouts en `permission_error`.
- **Adaptive Pricing exige que la devise des prix soit une devise de règlement**
  du compte. Les prix restent donc en CAD ; ne pas créer de prix en devise
  locale « pour aider », ça désactive la conversion automatique.
- Les prix, durées et libellés ne sont PAS en dur côté client (la grille lit
  `getAvailableProducts`). Seuls quelques **codes** le sont pour la mise en page
  (`pricing-grid.tsx` isole `premium_access`, la modale de paiement manuel a
  `exam_access` par défaut).
