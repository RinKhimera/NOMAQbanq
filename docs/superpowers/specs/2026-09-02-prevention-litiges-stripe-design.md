# Paiements — prévenir les litiges et outiller la réponse

Issue : https://github.com/RinKhimera/NOMAQbanq/issues/154
Branche : `feat/prevention-litiges-stripe`

## Contexte

Un litige `fraudulent` de 200 $ CA (août 2026, Sentry NOMAQBANQ-1H) a montré deux
choses. Le client n'avait aucune trace écrite de son achat émise par l'application,
et constituer le dossier de contestation a demandé une demi-journée de requêtes
manuelles. Le webhook, le fulfillment idempotent et la richesse des données d'usage
n'ont posé aucun problème et ne sont pas touchés.

Faits vérifiés le 2026-09-02 (compte Stripe en lecture seule, clé test ; AWS via
`claude-ops`) :

- Le descripteur de relevé du compte est déjà `NOMAQBANQ` et les charges
  affichent `calculated_statement_descriptor: "NOMAQBANQ"`. Le point A2 de
  l'issue est réglé au niveau compte ; aucun suffixe dynamique n'est ajouté.
- `receipt_email` est nul sur TOUTES les charges Checkout, y compris en test :
  Checkout ne renseigne pas ce champ. Sa nullité ne prouve donc pas qu'aucun
  reçu n'est parti. La doc Stripe garantit qu'un `receipt_email` posé sur le
  PaymentIntent déclenche un reçu en live « regardless of your email settings ».
- Via l'API, `business_profile.name`, `support_email` et `url` sont nuls. Stripe
  exige sur chaque reçu le nom légal, l'adresse et le courriel de support et
  l'URL de politique de confidentialité.
- Le configuration set SES `nomaqbanq-transactional` (us-east-2) n'a aucune
  destination d'événements. Aucun groupe de logs `/aws/events/*` n'existe.
- Frais de litige au Canada : 15 $ CA à la réception (jamais remboursé) + 15 $ CA
  à la contestation (remboursé si gagné). Les reçus Stripe sont gratuits ; les
  factures post-paiement coûtent 0,4 % plafonné à 2 $ US, hors périmètre.

## Décisions

- **3DS gratuit** : `request_three_d_secure: "any"` sur toutes les sessions,
  sans Radar for Fraud Teams. Clause de sortie : si la conversion du checkout
  baisse visiblement, retirer le paramètre (une ligne).
- **Pas de facture post-paiement** (A4 hors périmètre). Le reçu Stripe suffit à
  prévenir un litige ; la facture ne se justifie que pour un remboursement
  employeur, ce que personne n'a demandé.
- **Pas de révocation d'accès sur litige**, comme dans l'issue.
- **Aucun changement ne peut faire échouer l'octroi d'accès.** Tout ce qui
  s'ajoute au webhook après le fulfillment est en best-effort, capturé dans
  Sentry, et ne modifie jamais le code de réponse.

## Lot 1 — Prévenir et voir

### Session Checkout (`features/payments/actions.ts`, `createStripeCheckout`)

Paramètres ajoutés à `stripe.checkout.sessions.create` :

| Paramètre | Valeur | Effet |
|---|---|---|
| `payment_intent_data.receipt_email` | courriel du compte | reçu Stripe garanti, indépendant du toggle Dashboard |
| `payment_intent_data.description` | nom du produit | lisible sur le reçu et dans le Dashboard |
| `consent_collection.terms_of_service` | `"required"` | case CGU au checkout ; preuve recommandée par Stripe pour un litige |
| `payment_method_options.card.request_three_d_secure` | `"any"` | demande 3DS, préférence frictionless, la banque décide |

Prérequis Dashboard (bloquant) : l'URL des CGU doit être renseignée dans
Réglages → Informations publiques, sinon Stripe **refuse la création de session**
avec `consent_collection`. Le test manuel en mode test le vérifie avant tout
déploiement.

### Webhook (`app/api/stripe/webhook/route.ts`)

Quatre événements ajoutés, tous en 200 après traitement, 500 sur erreur DB
(contrat inchangé) :

| Événement | Traitement |
|---|---|
| `charge.dispute.updated` | met à jour `dispute_status` |
| `charge.dispute.closed` | met à jour `dispute_status` ; Sentry « litige gagné » ou « litige perdu » avec montant et `payment_intent` |
| `charge.dispute.funds_reinstated` | met à jour `dispute_status` ; Sentry informatif |
| `radar.early_fraud_warning.created` | Sentry « signal de fraude avant litige » avec `charge`, `payment_intent`, `fraud_type` ; suggère le remboursement proactif (Stripe : 80 % des EFW deviennent un litige) |

`charge.dispute.created` garde son alerte et pose désormais aussi
`stripe_dispute_id` + `dispute_status`.

Le Dashboard Stripe (endpoint de production) doit avoir ces quatre événements
cochés ; l'utilisateur l'a fait le 2026-09-02.

### Persistance (`db/schema/payments.ts`, migration Drizzle)

Deux colonnes nullables sur `transactions` :

- `stripe_dispute_id text` — identifiant `dp_…`.
- `dispute_status text` — valeur brute du `status` Stripe (`needs_response`,
  `under_review`, `won`, `lost`, `warning_needs_response`, `warning_under_review`,
  `warning_closed`), en texte libre : l'enum Stripe peut évoluer, une valeur
  inconnue ne doit pas faire échouer le webhook.

Nouvelle fonction DAL `recordStripeDispute` (`features/payments/stripe.ts`) :
`UPDATE transactions SET stripe_dispute_id, dispute_status WHERE
stripe_payment_intent_id = $1`. Garde-fou d'ordre : Stripe ne garantit pas
l'ordre de livraison, donc un statut terminal (`won`, `lost`, `warning_closed`)
n'est jamais écrasé par un non-terminal — l'UPDATE porte la condition
`dispute_status is null or dispute_status not in (terminaux)` quand le nouveau
statut n'est pas terminal. Idempotent par construction (même valeur réécrite).
Résultat `not_found` (aucune transaction pour ce `payment_intent`) → Sentry,
200.

### Admin (`features/payments/dal.ts`, `app/(admin)/admin/transactions`)

`AdminTransactionView` expose `disputeStatus: string | null`. La liste affiche
un badge « Litige » (rouge tant que non terminal, vert « gagné », gris
« perdu »). Aucun filtre ni page dédiée : le badge suffit à repérer une ligne.

### Vérifications Dashboard à la charge de l'utilisateur

1. Réglages → Informations publiques : nom, courriel de support, URL du site,
   URL des CGU, URL de politique de confidentialité.
2. Réglages → Courriels aux clients : « Paiements réussis » activé (ceinture,
   `receipt_email` étant les bretelles).
3. Endpoint webhook de production : les quatre événements cochés (fait).

## Lot 2 — Confirmation d'achat et preuve d'envoi

### Courriel (`email/templates/purchase-confirmation-email.tsx`, `email/index.tsx`)

Gabarit `PurchaseConfirmationEmail`, dans le layout existant. Contenu : nom du
produit, montant et devise d'encaissement, montant local si `presentment_*` est
présent (« soit environ 228 000 FCFA »), date d'achat, date de fin d'accès, la
phrase « Cette transaction apparaîtra sous le libellé NOMAQBANQ sur votre
relevé », lien vers `/tableau-de-bord/abonnements`, adresse de support. Aucun
lien vers le reçu Stripe : il arrive par un courriel séparé (`receipt_email`).

Fonction `sendPurchaseConfirmationEmail({ to, productName, amountPaid,
currency, presentmentAmount, presentmentCurrency, purchasedAt,
accessExpiresAt })` qui retourne le `MessageId` SES.

### Déclenchement (`app/api/stripe/webhook/route.ts`)

`completeStripeTransaction` retourne, dans le cas `completed`, les données
nécessaires au courriel (`userEmail`, `productName`, montants, dates), lues dans
la même transaction SQL (jointure `user` + `products` déjà chargés). Le webhook,
après le retour `completed` et donc après COMMIT, appelle
`sendPurchaseConfirmationEmail` dans un `try/catch` : succès → écrit
`confirmation_email_message_id` + `confirmation_email_sent_at` sur la
transaction ; échec → `captureServerError`, pas de nouvelle tentative, réponse
200 inchangée. Le cas `already_processed` n'envoie rien : un seul courriel par
achat, garanti par l'idempotence existante du fulfillment.

Les octrois manuels (`grantManualAccess`) n'envoient rien : hors périmètre.

### Persistance

Deux colonnes nullables sur `transactions` (même migration que le lot 1 si les
lots sont livrés ensemble, sinon migration séparée) :

- `confirmation_email_message_id text`
- `confirmation_email_sent_at timestamptz`

### Journal SES (infra, via `claude-ops`)

SES ne peut pas écrire directement dans CloudWatch Logs. Chaîne :

1. Destination d'événements `nomaqbanq-eventbridge` sur le configuration set
   `nomaqbanq-transactional`, type EventBridge (bus par défaut), événements
   `SEND`, `DELIVERY`, `BOUNCE`, `COMPLAINT`, `REJECT`, `RENDERING_FAILURE`.
2. Règle EventBridge `nomaqbanq-ses-events`, motif `{"source": ["aws.ses"]}`.
3. Groupe de logs `/aws/events/nomaqbanq-ses`, rétention 400 jours (fenêtre de
   litige de 120 jours avec marge), policy de ressource autorisant
   `events.amazonaws.com` et `delivery.logs.amazonaws.com` à y écrire.
4. Cible de la règle : ce groupe de logs.

Coût : nul à ce volume (quelques centaines d'événements par mois). Le journal
ne contient que les métadonnées (destinataire, `messageId`, statut, horodatage),
jamais le corps. Vérification : un envoi de test en sandbox, puis
`FilterLogEvents` sur le `messageId` retourné.

## Lot 3 — Script `dispute:evidence`

`bun scripts/dispute-evidence.ts <payment_intent> [--out fichier.md]`, script
`"dispute:evidence"` dans `package.json`. Modèle : `audit-stripe-transactions.ts`.

- Lecture seule. Env dédié : `AUDIT_DATABASE_URL` (branche Neon lue),
  `STRIPE_AUDIT_KEY` (optionnelle, clé live lecture : sans elle, la section
  litige est omise). Refus d'une clé non live, comme l'audit.
- Résout la transaction par `stripe_payment_intent_id`, puis lit : `user`
  (nom, courriel, `email_verified`, `created_at`), `account` (méthode de
  connexion), `transactions` de l'utilisateur, `user_access`, `session` (IP,
  user-agent, création, expiration), `exam_participations` avec
  `count(exam_answers)` par participation, `training_sessions` avec
  `count(training_session_items)`, marqueurs `results_notified_at` et
  `expiry_reminder_sent_at`, `confirmation_email_sent_at`. Toutes les lectures
  bornées (`limit 1000`, tri chronologique).
- Avec la clé Stripe : `disputes.retrieve` → motif, montant, statut,
  `evidence_details.due_by`, et `charges.retrieve` → pays de la carte, résultat
  3DS.
- Sortie Markdown, une section par champ de preuve Stripe pour un produit
  numérique : `customer_name`, `customer_email_address`,
  `product_description` (texte fixe décrivant le produit acheté),
  `access_activity_log` (journal chronologique, une ligne par événement :
  horodatage UTC, type, détail, IP/UA quand disponible), puis un bloc
  « Contexte » (date limite, motif, 3DS). Le journal est prêt à coller dans le
  champ `access_activity_log` du Dashboard.
- `dispute-evidence*.md` ajouté à `.gitignore` (données personnelles).

## Tests

- **Webhook** (`tests/features/stripe-webhook-errors.test.ts`) : un cas par
  nouvel événement (`updated`, `closed` gagné, `closed` perdu,
  `funds_reinstated`, EFW), `closed` puis `updated` tardif ne régresse pas le
  statut, `not_found` → Sentry + 200, échec d'envoi du courriel → Sentry + 200,
  `already_processed` → aucun envoi.
- **Fulfillment** (`tests/integration/payments-stripe.test.ts`) : forme de
  retour enrichie sur `completed` ; `recordStripeDispute` sur vraie base avec le
  garde-fou d'ordre.
- **Checkout** : les quatre paramètres présents dans l'appel
  `checkout.sessions.create` (mock du client Stripe).
- **Courriel** : rendu du gabarit (sujet, montant, libellé NOMAQBANQ, montant
  local présent/absent).
- **Script** (`tests/scripts/dispute-evidence.test.ts`) : formatage du journal
  à partir de lignes fixes, tri chronologique, omission propre de la section
  Stripe sans clé.
- **Manuel, mode test** : carte `4000000000000259` crée un litige ; soumettre
  une preuve `uncategorized_text = winning_evidence` ou `losing_evidence` le
  ferme et émet `charge.dispute.closed` ; carte `4000000000005423` émet un EFW.
  Relais local par `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Hors périmètre

- Factures post-paiement (A4) et exposition du `receipt_url` dans l'app.
- Suffixe de descripteur de relevé.
- Radar for Fraud Teams.
- Courriel de confirmation pour les octrois manuels.
- Réponse automatisée aux litiges : la décision reste humaine.
- Stockage du contenu des courriels envoyés.
