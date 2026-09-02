# Paiements — prévenir les litiges et outiller la réponse

Issue : https://github.com/RinKhimera/NOMAQbanq/issues/154
Branche : `feat/prevention-litiges-stripe`
Revue de design : `docs/superpowers/reviews/2026-09-02-revue-design-prevention-litiges-stripe.md`
(14 constats, tous intégrés ci-dessous).

## Contexte

Un litige `fraudulent` de 200 $ CA (août 2026, Sentry NOMAQBANQ-1H) a montré deux
choses. Le client n'avait aucune trace écrite de son achat émise par l'application,
et constituer le dossier de contestation a demandé une demi-journée de requêtes
manuelles. Le webhook, le fulfillment idempotent et la richesse des données d'usage
n'ont posé aucun problème et ne sont pas touchés.

Faits vérifiés le 2026-09-02 (compte Stripe en lecture seule, clé test ; AWS via
`claude-ops` ; revue de design) :

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
- `EMAIL_FROM` est une adresse `noreply@` (fixture de `tests/email/send.test.ts`)
  et `sendEmail` ne pose aucun `ReplyToAddresses` : inviter à « répondre à ce
  courriel » serait une promesse vide.
- Stripe documente qu'un paiement peut recevoir **plusieurs litiges** (« Receive
  multiple disputes »). Le SDK installé connaît le statut `prevented`.
- `request_three_d_secure` n'existe que sous `payment_method_options.card`. Un
  paiement **Link « pur »** (`payment_method_details.type = "link"`) n'est pas
  couvert et ne porte structurellement aucun résultat 3DS ; un paiement carte
  via le portefeuille Link (`card.wallet.link`) l'est.
- Frais de litige au Canada : 15 $ CA à la réception (jamais remboursé) + 15 $ CA
  à la contestation (remboursé si gagné). Les reçus Stripe sont gratuits ; les
  factures post-paiement coûtent 0,4 % plafonné à 2 $ US, hors périmètre.

## Décisions

- **3DS gratuit** : `request_three_d_secure: "any"` sur toutes les sessions,
  sans Radar for Fraud Teams. Il couvre les paiements carte (directs ou via le
  portefeuille Link), pas Link « pur ». **Le paiement d'août était du Link pur**
  (Dashboard, ligne « Moyen de paiement » : « Link » seul, vérifié le
  2026-09-02) : ce n'est donc pas cette mesure qui aurait couvert son cas, c'est
  l'alerte EFW et le remboursement proactif. Exclure Link du Checkout
  (`payment_method_types: ["card"]`) est **refusé par l'utilisateur** : coût
  de conversion certain pour un gain incertain. Clause de sortie du 3DS : si
  la conversion du checkout baisse visiblement, retirer le paramètre.
- **Pas de facture post-paiement** (A4 hors périmètre). Le reçu Stripe suffit à
  prévenir un litige ; la facture ne se justifie que pour un remboursement
  employeur, ce que personne n'a demandé.
- **Pas de révocation d'accès sur litige**, comme dans l'issue.
- **Aucun changement ne peut faire échouer l'octroi d'accès ni allonger la
  requête webhook.** Tout ce qui s'ajoute après le fulfillment est en
  best-effort, capturé dans Sentry, exécuté **après le 200** (`waitUntil`), et
  ne modifie jamais le code de réponse.
- **Adresse de support explicite** : nouvelle variable d'environnement
  optionnelle `SUPPORT_EMAIL`. Quand elle est présente, elle sert de `Reply-To`
  à tous les courriels et figure dans le courriel de confirmation. Sans elle, le
  courriel n'invite pas à répondre. Valeur initiale : l'adresse personnelle du
  propriétaire (décision du 2026-09-02, à remplacer par une boîte dédiée plus
  tard).

## Lot 1 — Prévenir et voir

### Session Checkout (`features/payments/actions.ts`, `createStripeCheckout`)

Paramètres ajoutés à `stripe.checkout.sessions.create` :

| Paramètre | Valeur | Effet |
|---|---|---|
| `payment_intent_data.receipt_email` | courriel du compte | reçu Stripe garanti, indépendant du toggle Dashboard |
| `payment_intent_data.description` | nom du produit | lisible sur le reçu et dans le Dashboard |
| `consent_collection.terms_of_service` | `"required"` | case CGU au checkout ; preuve recommandée par Stripe pour un litige |
| `payment_method_options.card.request_three_d_secure` | `"any"` | demande 3DS aux paiements carte, préférence frictionless, la banque décide |

Prérequis Dashboard (bloquant) : l'URL des CGU doit être renseignée dans
Réglages → Informations publiques, sinon Stripe **refuse la création de
session** et 100 % des ventes tombent avec le message générique « Réessayez ».
Deux garde-fous :

1. Ces paramètres sont livrés dans un **commit isolé, en dernier dans le
   lot 1**, après confirmation du réglage Dashboard et un achat de test
   réussi. Un revert d'une ligne suffit à les retirer.
2. Le `catch` de `createStripeCheckout` reconnaît l'erreur Stripe dont le
   `param` commence par `consent_collection` : alerte Sentry qui nomme la cause
   et message « Ce produit est mal configuré. Contactez le support. » au lieu
   d'inviter à retenter une panne permanente.

### Webhook (`app/api/stripe/webhook/route.ts`)

Quatre événements ajoutés, tous en 200 après traitement, 500 sur erreur DB
(contrat inchangé). **L'alerte Sentry est émise AVANT toute écriture en base**,
pour qu'une panne Neon ne prive pas l'alerte de son détail (id, montant, motif,
`payment_intent`) :

| Événement | Traitement |
|---|---|
| `charge.dispute.created` | alerte « litige ouvert » (inchangée), puis persiste |
| `charge.dispute.updated` | persiste, aucune alerte |
| `charge.dispute.closed` | alerte « litige gagné » / « litige perdu » / « litige clos », puis persiste |
| `charge.dispute.funds_reinstated` | alerte « fonds restitués après litige », puis persiste |
| `radar.early_fraud_warning.created` | alerte « signal de fraude avant litige » avec `charge`, `payment_intent`, `fraud_type` ; propose le remboursement proactif (Stripe : 80 % des EFW deviennent un litige) |

Persistance en `not_found` (aucune transaction pour ce `payment_intent`) :
alerte dédiée **en plus** de l'alerte de cycle de vie, jamais à sa place.

Le Dashboard Stripe (endpoint de production) doit avoir ces quatre événements
cochés ; l'utilisateur l'a fait le 2026-09-02.

### Persistance (`db/schema/payments.ts`, migration Drizzle)

Quatre colonnes nullables sur `transactions`, une seule migration (expand
only ; ne jamais reverter cette migration isolément, `drizzle-kit generate`
produirait un `DROP COLUMN`) :

- `stripe_dispute_id text` — identifiant `dp_…` du litige courant.
- `dispute_status text` — valeur brute du `status` Stripe (`needs_response`,
  `under_review`, `won`, `lost`, `prevented`, `warning_needs_response`,
  `warning_under_review`, `warning_closed`, ou toute valeur future), en texte
  libre : l'enum Stripe peut évoluer, une valeur inconnue ne doit pas faire
  échouer le webhook.
- `confirmation_email_message_id text`, `confirmation_email_sent_at timestamptz`
  (lot 2).

Nouvelle fonction DAL `recordStripeDispute` (`features/payments/stripe.ts`) :
`UPDATE transactions SET stripe_dispute_id, dispute_status WHERE
stripe_payment_intent_id = $1 AND <garde-fou>`. Statuts terminaux : `won`,
`lost`, `warning_closed`, `prevented`. Garde-fou d'ordre **scopé au litige** :
Stripe ne garantit pas l'ordre de livraison, donc un statut terminal n'est
jamais écrasé par un non-terminal **du même litige** ; mais un litige
différent (`stripe_dispute_id` distinct, cas « plusieurs litiges par
paiement ») remplace toujours le précédent, même clos. Résultats :
`recorded`, `kept_terminal` (même litige, statut ancien redélivré),
`not_found`. Idempotent par construction. L'UPDATE unique suffit à la
sérialisation (READ COMMITTED réévalue le prédicat sur la ligne réécrite).

### Admin (`features/payments/dal.ts`, `app/(admin)/admin/transactions`)

`AdminTransactionView` expose `disputeStatus: string | null`. La table affiche
un badge à côté du statut : « Litige en cours » (rouge) pour tout statut non
terminal ou inconnu, « Litige gagné » et « Litige évité » (`prevented`) en vert,
« Litige perdu » et « Enquête close » en gris. Aucun filtre ni page dédiée.
L'espace étudiant (`abonnements-client.tsx`) a son propre adaptateur et ne
montre rien.

### Vérifications Dashboard à la charge de l'utilisateur

1. Réglages → Informations publiques : nom, courriel de support, URL du site,
   URL des CGU, URL de politique de confidentialité.
2. Réglages → Courriels aux clients : « Paiements réussis » activé (ceinture,
   `receipt_email` étant les bretelles).
3. Endpoint webhook de production : les quatre événements cochés (fait).
4. Page du paiement contesté d'août : noter la ligne « Moyen de paiement »
   (« Link » seul, ou une marque de carte « via Link »).

## Lot 2 — Confirmation d'achat et preuve d'envoi

### Adresse de support et Reply-To (`lib/env/schema.ts`, `email/send.ts`)

`SUPPORT_EMAIL` optionnelle (zod). Quand présente, `sendEmail` ajoute
`ReplyToAddresses: [SUPPORT_EMAIL]` à toutes les commandes SES. Ajout via
`vercel env add SUPPORT_EMAIL development` puis `bun run env:sync`, pas
d'édition manuelle de `.env.local`.

### Courriel (`email/templates/purchase-confirmation-email.tsx`, `email/index.tsx`)

Gabarit `PurchaseConfirmationEmail`, dans le layout existant. Contenu : nom du
produit, montant et devise d'encaissement, montant local si `presentment_*` est
présent (« soit environ 228 000 FCFA »), date d'achat, **une ligne par accès
réellement octroyé** avec sa date de fin effective (un combo en a deux, et un
accès existant plus long garde sa date), la phrase « Cette transaction
apparaîtra sous le libellé NOMAQBANQ sur votre relevé », lien vers
`/tableau-de-bord/abonnements`, et, si `SUPPORT_EMAIL` est définie, « Une
question ? Écrivez-nous à … avant toute démarche auprès de votre banque ».
Aucun lien vers le reçu Stripe : il arrive par un courriel séparé.

Fonction `sendPurchaseConfirmationEmail({ to, productName, amountPaid,
currency, presentmentAmount, presentmentCurrency, purchasedAt, grantedAccess })`
qui retourne le `MessageId` SES.

### Déclenchement (`app/api/stripe/webhook/route.ts`)

`completeStripeTransaction` retourne, dans le cas `completed`, les données
nécessaires au courriel : courriel du compte (**null si le compte est
anonymisé**, `anonymizedAt` non nul, lu sous le même verrou `user FOR UPDATE`),
nom du produit, montants, date, et `grantedAccess: { accessType, expiresAt }[]`
avec les expirations **effectivement écrites** (`finalExpiry`, pas
`txAccessExpiresAt`).

Le webhook, après le retour `completed`, passe l'envoi à `waitUntil` de
`@vercel/functions` (déjà dépendance) : **le 200 part immédiatement**, comme
l'exige Stripe (« must quickly return a 2xx before any complex logic that could
cause a timeout »). L'envoi tourne ensuite : succès → écrit
`confirmation_email_message_id` + `confirmation_email_sent_at` ; échec →
`captureServerError`, pas de nouvelle tentative. Courriel nul (compte anonymisé)
→ rien n'est envoyé, capture explicite. Le cas `already_processed` n'envoie
rien : un seul courriel par achat, garanti par l'idempotence existante du
fulfillment.

Détectabilité : une transaction `completed` de plus de quelques minutes avec
`confirmation_email_sent_at` nul est le critère d'une reprise future ; aucun
cron n'est ajouté maintenant.

Les octrois manuels (`grantManualAccess`) n'envoient rien : hors périmètre.

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

Coût : nul à ce volume. Le journal ne contient que les métadonnées
(destinataire, `messageId`, statut, horodatage), jamais le corps. Vérification :
un envoi de test en sandbox, puis `FilterLogEvents` sur le `messageId`.

## Lot 3 — Script `dispute:evidence`

`bun scripts/dispute-evidence.ts <payment_intent> [--out fichier.md]`, script
`"dispute:evidence"` dans `package.json`. Modèle : `audit-stripe-orphelins.ts`.

- Lecture seule. Env dédié : `AUDIT_DATABASE_URL` (branche Neon lue),
  `AUDIT_STRIPE_KEY` (optionnelle, clé live lecture : sans elle, la section
  litige est omise). Refus d'une clé non live.
- Résout la transaction par `stripe_payment_intent_id`, puis lit : `user`
  (nom, courriel, `email_verified`, `created_at`), `account` (méthode de
  connexion), `session` (IP, user-agent, création), `exam_participations` avec
  `count(exam_answers.selected_answer)` par participation, `training_sessions`
  avec `count(training_session_items.selected_answer)`, marqueurs
  `results_notified_at` et `confirmation_email_sent_at`. Toutes les lectures
  bornées (`limit 1000`) **et ordonnées** (troncature déterministe).
- Avec la clé Stripe : `disputes.list({ payment_intent })` → motif, montant,
  statut, `evidence_details.due_by` ; `charges.retrieve` → **type de moyen de
  paiement** (`payment_method_details.type`), pays (`card.country` ou
  `link.country`), résultat 3DS quand `card` est présent, « non applicable
  (Link) » pour un paiement Link pur.
- Sortie Markdown, une section par champ de preuve Stripe pour un produit
  numérique : `customer_name`, `customer_email_address`,
  `product_description`, `access_activity_log` (journal chronologique, une
  ligne par événement : horodatage UTC, type, détail, IP/UA quand disponible),
  puis un bloc « Contexte du litige ».
- `dispute-evidence*.md` ajouté à `.gitignore` (données personnelles).

## Tests

- **Webhook** (`tests/features/stripe-webhook-errors.test.ts`) : un cas par
  nouvel événement, alerte `created` émise même si la base échoue, `not_found`
  → deux alertes, échec DB → 500, `waitUntil` reçoit la promesse d'envoi,
  échec d'envoi → Sentry sans changer le 200, `already_processed` → aucun
  envoi, courriel nul → aucun envoi.
- **Fulfillment** (`tests/integration/payments-stripe.test.ts`) : forme de
  retour enrichie sur `completed` (utilisateur dédié `U_CONFIRM`), combo
  par-dessus un accès plus long → `grantedAccess` porte la date la plus
  tardive, compte anonymisé → `userEmail` nul ; `recordStripeDispute` : même
  litige non-terminal après terminal → `kept_terminal`, **second litige après
  un terminal → `recorded`**, `not_found`.
- **Checkout** : les quatre paramètres présents ; erreur `consent_collection`
  → message dédié.
- **Courriel** : rendu du gabarit (avec et sans montant local, avec et sans
  support, deux accès), `sendPurchaseConfirmationEmail` (assertions
  normalisées sur les espaces ICU, cas sans montant local), `Reply-To` posé
  quand `SUPPORT_EMAIL` existe.
- **Badge** : logique pure + un rendu de `TransactionTable` avec
  `disputeStatus`.
- **Script** (`tests/scripts/dispute-evidence.test.ts`) : formatage du journal,
  tri, section Stripe omise sans clé, paiement Link.
- **Couverture** : clôture par `bun run test:coverage` et
  `bun run test:coverage:full` (seuil 80 %), pas par `bun run test`.
- **Manuel, mode test** : carte `4000000000000259` crée un litige ; soumettre
  une preuve `uncategorized_text = winning_evidence` ou `losing_evidence` le
  ferme et émet `charge.dispute.closed` ; carte `4000000000005423` émet un EFW.
  Relais local par `stripe listen --forward-to localhost:<port>/api/stripe/webhook`.

## Hors périmètre

- Factures post-paiement (A4) et exposition du `receipt_url` dans l'app.
- Suffixe de descripteur de relevé.
- Radar for Fraud Teams ; exclusion de Link du Checkout.
- Courriel de confirmation pour les octrois manuels ; reprise automatique des
  courriels non envoyés.
- Réponse automatisée aux litiges : la décision reste humaine.
- Stockage du contenu des courriels envoyés.
