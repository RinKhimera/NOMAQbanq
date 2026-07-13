# Paiements Stripe — architecture actuelle (Drizzle / Better Auth)

> Stack backend : Drizzle/Neon + Better Auth (voir `AGENTS.md` et
> `.claude/rules/data-layer.md`). Ce document décrit le flux de paiement **tel
> qu'il existe** — toutes les pages listées sont déjà implémentées.

## Flux de paiement

```
1. L'utilisateur clique « Acheter » (page /tarifs ou paywall).
2. Server Action `createStripeCheckout({ productCode, successPath, cancelPath })`
   (features/payments/actions.ts) : garde `requireSession`, crée la session
   Stripe Checkout (mode "payment", customer_email, metadata userId/productId/…)
   ET insère une transaction `status: "pending"`.
3. Le client est redirigé vers `checkoutUrl` (page Stripe hébergée).
4. Paiement sur Stripe → redirection vers `successPath?session_id={CHECKOUT_SESSION_ID}`.
5. En parallèle, Stripe POST le webhook `app/api/stripe/webhook/route.ts`
   (signature vérifiée) → sur `checkout.session.completed` + `payment_status: "paid"`,
   appelle `completeStripeTransaction` (features/payments/stripe.ts).
6. `completeStripeTransaction` (idempotent via `stripeEventId`) passe la
   transaction à `completed`, persiste le montant/devise réellement facturés, et
   crée/prolonge la ligne `userAccess` (cumul du temps pour un accès simple ;
   fenêtre fraîche pour un combo — voir Invariants).
7. La page de succès (`/tableau-de-bord/paiement/succes`) appelle
   `verifyStripeCheckout(sessionId)` pour AFFICHER le statut — elle ne crédite
   PAS l'accès (c'est le webhook qui fait foi). Anti-IDOR : la session est
   refusée si `metadata.userId` ≠ utilisateur courant.
```

Le crédit d'accès est **toujours** fait par le webhook, jamais par la page de
succès (résistant à un utilisateur qui ne revient pas sur `successPath`).

## Modules

| Module                            | Rôle                                                                                                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/payments/actions.ts`    | Server Actions : `createStripeCheckout`, `verifyStripeCheckout`, `createCustomerPortal` ; paiements manuels admin (`recordManualPayment`, `updateManualTransaction`, `deleteManualTransaction`) ; loaders (`loadUserAccessStatus`, `loadAdminTransactions`, `loadTransactionStats`…). |
| `features/payments/stripe.ts`     | Fulfillment serveur : `completeStripeTransaction` (crédit d'accès idempotent), `failStripeTransaction` (session expirée).                                                                                                                                                             |
| `features/payments/dal.ts`        | Lectures `server-only` : `getAccessStatus`, `hasAccess`, `getAvailableProducts`, `getMyTransactions`, `getAllTransactions`, `getTransactionStats`, `getRevenueByDay`, `getExpiringAccess`.                                                                                            |
| `app/api/stripe/webhook/route.ts` | Endpoint webhook (`runtime = "nodejs"`, signature vérifiée).                                                                                                                                                                                                                          |
| `lib/stripe.ts`                   | `getStripe()`, `getStripeWebhookSecret()` (SDK + secrets).                                                                                                                                                                                                                            |

## Produits

Enum `product_code` (`db/schema/enums.ts`) : `exam_access`, `training_access`,
`exam_access_promo`, `training_access_promo`, `premium_access`. Les produits
(prix, durée, `stripePriceId`, `isCombo`…) vivent dans la table `products`,
seedée en base — un produit `isCombo` (`premium_access`) octroie exam **et**
training. Les prix/durées/labels ne sont PAS en dur côté client (la grille lit
`getAvailableProducts`) ; en revanche quelques codes le sont pour la mise en
page : `pricing-grid.tsx` isole `premium_access` (carte combo mise en avant) et
la modale de paiement manuel a `exam_access` par défaut.

## Pages (déjà implémentées)

| Page                                    | Fichier                                                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Tarifs / achat                          | `app/(marketing)/tarifs/page.tsx` (+ `_components/pricing-grid.tsx`)                                                                           |
| Succès paiement                         | `app/(dashboard)/tableau-de-bord/paiement/succes/page.tsx` (rend `PaymentSuccessContent` de `paiement/_components/payment-success-client.tsx`) |
| Mes abonnements / portail               | `app/(dashboard)/tableau-de-bord/abonnements/`                                                                                                 |
| Admin transactions + paiement manuel    | `app/(admin)/admin/transactions/` (+ `components/shared/payments/manual-payment-modal.tsx`)                                                    |
| Section accès (fiche utilisateur admin) | `app/(admin)/admin/utilisateurs/[id]/`                                                                                                         |
| Paywall entraînement                    | `app/(dashboard)/tableau-de-bord/entrainement/_components/training-paywall.tsx`                                                                |

## Invariants à connaître

- **Webhook** : endpoint `/api/stripe/webhook` (pointer le dashboard Stripe
  dessus + définir `STRIPE_WEBHOOK_SECRET`). Réponses : `400` signature
  invalide (jamais rejoué), `500` erreur inattendue → Stripe **réessaie** (ne
  jamais avaler une erreur transitoire en 200), `200` traité ou ignoré.
- **Idempotence** : `completeStripeTransaction` est gardé sur `stripeEventId` —
  pas de double-activation si Stripe renvoie l'événement.
- **Cumul du temps** : un achat d'accès simple alors qu'un accès du même type
  est actif **prolonge** l'expiration (15 j restants + 30 j = 45 j). **Exception
  combo** (`isCombo`/`premium_access`, `features/payments/stripe.ts`) : la
  fenêtre est posée à `now + durée` (pas de cumul avec l'existant).
- **Montant/devise** : stockés en **centièmes** (`amountPaid` en cents CAD). Le
  webhook persiste `amount_total`/`currency` réels de Stripe (promo, Adaptive
  Pricing) ; XAF est **zéro-décimal chez Stripe** → converti ×100 au fulfillment
  (cf. correctif #79/#80).
- **Accès admin** : `role === "admin"` bypasse `hasAccess` — pas de paiement
  requis pour examens/entraînement.
- **Cartes de test Stripe** : succès `4242 4242 4242 4242` · refus
  `4000 0000 0000 0002`.
