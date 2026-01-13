# Spécification Frontend - Intégration Stripe NOMAQbanq

## Résumé

Le backend Stripe est entièrement implémenté. Ce document décrit les fonctions Convex disponibles et comment les utiliser côté frontend pour implémenter les pages de paiement.

---

## Configuration requise

### Variables d'environnement (.env.local)

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # ou pk_live_...
```

### Installation (déjà fait)

```bash
npm install stripe @stripe/stripe-js
```

---

## Architecture des paiements

### Produits disponibles

| Code | Nom | Prix | Durée | Type d'accès |
|------|-----|------|-------|--------------|
| `exam_access` | Accès Examens - 1 mois | 50 CAD | 30 jours | exam |
| `training_access` | Accès Entraînement - 1 mois | 50 CAD | 30 jours | training |
| `exam_access_promo` | Accès Examens - 6 mois | 200 CAD | 180 jours | exam |
| `training_access_promo` | Accès Entraînement - 6 mois | 200 CAD | 180 jours | training |

### Flux de paiement Stripe

```
1. User clique "Acheter"
2. Frontend appelle createCheckoutSession(productCode, successUrl, cancelUrl)
3. Backend crée session Stripe + transaction "pending"
4. Frontend redirige vers checkoutUrl (page Stripe hosted)
5. User paie sur Stripe
6. Stripe redirige vers successUrl?session_id=xxx
7. Webhook Stripe → completeStripeTransaction → userAccess créé/mis à jour
8. Frontend affiche page de succès
```

### Cumul du temps

Si un utilisateur a déjà un accès actif et achète à nouveau :
- Le nouveau temps est **ajouté** à l'expiration existante
- Exemple : 15 jours restants + 30 jours achetés = 45 jours total

---

## Fonctions Convex disponibles

### Queries - Accès utilisateur

#### `payments.hasExamAccess`
Vérifie si l'utilisateur a un accès actif aux examens.

```typescript
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

const hasAccess = useQuery(api.payments.hasExamAccess)
// Returns: boolean
```

#### `payments.hasTrainingAccess`
Vérifie si l'utilisateur a un accès actif à l'entraînement.

```typescript
const hasAccess = useQuery(api.payments.hasTrainingAccess)
// Returns: boolean
```

#### `payments.getMyAccessStatus`
Récupère le statut complet des accès de l'utilisateur.

```typescript
const accessStatus = useQuery(api.payments.getMyAccessStatus)
// Returns:
// {
//   examAccess: { expiresAt: number, daysRemaining: number } | null,
//   trainingAccess: { expiresAt: number, daysRemaining: number } | null
// }
```

### Queries - Produits

#### `payments.getAvailableProducts`
Liste tous les produits actifs disponibles à l'achat.

```typescript
const products = useQuery(api.payments.getAvailableProducts)
// Returns: Array<{
//   _id: Id<"products">,
//   code: "exam_access" | "training_access" | "exam_access_promo" | "training_access_promo",
//   name: string,
//   description: string,
//   priceCAD: number,      // En cents (5000 = 50$)
//   durationDays: number,
//   accessType: "exam" | "training",
//   stripeProductId: string,
//   stripePriceId: string,
//   isActive: boolean
// }>
```

### Queries - Transactions utilisateur

#### `payments.getMyTransactions`
Historique des transactions de l'utilisateur connecté (paginé).

```typescript
import { usePaginatedQuery } from "convex/react"

const { results, status, loadMore } = usePaginatedQuery(
  api.payments.getMyTransactions,
  {},
  { initialNumItems: 10 }
)
// Returns paginated:
// {
//   _id: Id<"transactions">,
//   type: "stripe" | "manual",
//   status: "pending" | "completed" | "failed" | "refunded",
//   amountPaid: number,
//   currency: string,
//   accessType: "exam" | "training",
//   durationDays: number,
//   createdAt: number,
//   completedAt?: number,
//   product: { name: string, ... } | null
// }
```

### Actions Stripe

#### `stripe.createCheckoutSession`
Crée une session de paiement Stripe et retourne l'URL de redirection.

```typescript
import { useAction } from "convex/react"
import { api } from "@/convex/_generated/api"

const createCheckout = useAction(api.stripe.createCheckoutSession)

// Usage
const handleBuy = async (productCode: string) => {
  try {
    const { checkoutUrl, sessionId } = await createCheckout({
      productCode: productCode as "exam_access" | "training_access" | "exam_access_promo" | "training_access_promo",
      successUrl: `${window.location.origin}/payment/success`,
      cancelUrl: `${window.location.origin}/pricing`,
    })

    if (checkoutUrl) {
      window.location.href = checkoutUrl
    }
  } catch (error) {
    console.error("Erreur lors de la création du checkout:", error)
  }
}
```

#### `stripe.verifyCheckoutSession`
Vérifie le statut d'une session après retour de Stripe (page de succès).

```typescript
const verifySession = useAction(api.stripe.verifyCheckoutSession)

// Usage (dans la page de succès)
const sessionId = searchParams.get("session_id")
const result = await verifySession({ sessionId })
// Returns:
// {
//   success: boolean,
//   status: string,
//   customerEmail: string,
//   metadata: object,
//   amountTotal: number,
//   currency: string
// }
```

#### `stripe.createCustomerPortalSession`
Crée une session pour le portail client Stripe (gestion des factures).

```typescript
const createPortal = useAction(api.stripe.createCustomerPortalSession)

const handleManageBilling = async () => {
  const { portalUrl } = await createPortal({
    returnUrl: `${window.location.origin}/account`,
  })
  window.location.href = portalUrl
}
```

---

## Queries Admin

#### `payments.getAllTransactions`
Toutes les transactions avec filtres (admin seulement).

```typescript
const { results, status, loadMore } = usePaginatedQuery(
  api.payments.getAllTransactions,
  {
    type: "stripe",           // Optionnel: "stripe" | "manual"
    status: "completed",      // Optionnel: "pending" | "completed" | "failed" | "refunded"
    userId: userId            // Optionnel: Id<"users">
  },
  { initialNumItems: 20 }
)
// Returns enriched transactions with user and product details
```

#### `payments.getTransactionStats`
Statistiques pour le dashboard admin.

```typescript
const stats = useQuery(api.payments.getTransactionStats)
// Returns:
// {
//   totalRevenue: number,        // En cents
//   totalTransactions: number,
//   recentRevenue: number,       // 30 derniers jours
//   recentTransactions: number,
//   stripeTransactions: number,
//   manualTransactions: number
// }
```

#### `payments.getUserAccessStatus`
Statut d'accès d'un utilisateur spécifique (admin).

```typescript
const userAccess = useQuery(api.payments.getUserAccessStatus, { userId })
// Returns same format as getMyAccessStatus
```

### Mutations Admin

#### `payments.recordManualPayment`
Enregistre un paiement manuel (cash, Interac, etc.).

```typescript
const recordPayment = useMutation(api.payments.recordManualPayment)

await recordPayment({
  userId: userId,                    // Id<"users">
  productCode: "exam_access",        // ProductCode
  amountPaid: 5000,                  // En cents
  currency: "CAD",
  paymentMethod: "interac",          // "cash" | "interac" | "virement" | etc.
  notes: "Paiement reçu le 15 janvier"  // Optionnel
})
```

#### `payments.upsertProduct`
Crée ou met à jour un produit (admin, nécessite auth).

```typescript
const upsertProduct = useMutation(api.payments.upsertProduct)

await upsertProduct({
  code: "exam_access",
  name: "Accès Examens - 1 mois",
  description: "...",
  priceCAD: 5000,
  durationDays: 30,
  accessType: "exam",
  stripeProductId: "prod_xxx",
  stripePriceId: "price_xxx",
  isActive: true
})
```

---

## Pages à implémenter

### 1. Page Pricing (`/pricing` ou `/tarifs`)

**Objectif** : Afficher les produits et permettre l'achat.

**Fonctions utilisées** :
- `useQuery(api.payments.getAvailableProducts)` - Liste des produits
- `useQuery(api.payments.getMyAccessStatus)` - Accès actuels (pour afficher "Déjà actif")
- `useAction(api.stripe.createCheckoutSession)` - Lancer le paiement

**UI suggérée** :
- Grille de cartes produits
- Badge "Actif jusqu'au XX" si l'utilisateur a déjà l'accès
- Bouton "Acheter" ou "Prolonger" selon le statut
- Afficher le prix formaté (priceCAD / 100 + " $")

### 2. Page Success (`/payment/success`)

**Objectif** : Confirmer le paiement après retour de Stripe.

**Fonctions utilisées** :
- `useAction(api.stripe.verifyCheckoutSession)` - Vérifier le paiement
- `useQuery(api.payments.getMyAccessStatus)` - Afficher le nouvel accès

**UI suggérée** :
- État de chargement pendant la vérification
- Message de succès avec détails (produit, montant)
- Lien vers le dashboard ou les examens/training
- Gestion de l'erreur si session invalide

**Code exemple** :
```typescript
"use client"

import { useSearchParams } from "next/navigation"
import { useAction, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useEffect, useState } from "react"

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")

  const verifySession = useAction(api.stripe.verifyCheckoutSession)
  const accessStatus = useQuery(api.payments.getMyAccessStatus)

  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (sessionId) {
      verifySession({ sessionId })
        .then(setVerificationResult)
        .finally(() => setIsLoading(false))
    }
  }, [sessionId])

  if (isLoading) return <LoadingSpinner />

  if (!verificationResult?.success) {
    return <ErrorMessage />
  }

  return <SuccessMessage accessStatus={accessStatus} />
}
```

### 3. Page Account/Billing (`/account` ou `/compte`)

**Objectif** : Voir ses accès et gérer la facturation.

**Fonctions utilisées** :
- `useQuery(api.payments.getMyAccessStatus)` - Statut des accès
- `usePaginatedQuery(api.payments.getMyTransactions)` - Historique
- `useAction(api.stripe.createCustomerPortalSession)` - Portail Stripe

**UI suggérée** :
- Section "Mes accès" avec dates d'expiration
- Bouton "Prolonger" si accès actif mais bientôt expiré
- Historique des transactions en tableau
- Bouton "Gérer mes factures" → Customer Portal

### 4. Admin - Transactions (`/admin/transactions`)

**Objectif** : Voir toutes les transactions et enregistrer des paiements manuels.

**Fonctions utilisées** :
- `usePaginatedQuery(api.payments.getAllTransactions)` - Liste
- `useQuery(api.payments.getTransactionStats)` - Stats
- `useMutation(api.payments.recordManualPayment)` - Paiement manuel

**UI suggérée** :
- Cards avec stats (revenus, transactions)
- Filtres (type, status, utilisateur)
- Tableau des transactions
- Modal "Enregistrer paiement manuel"

### 5. Admin - User Detail (`/admin/users/[id]`)

**Ajout** : Section accès de l'utilisateur.

**Fonctions utilisées** :
- `useQuery(api.payments.getUserAccessStatus, { userId })` - Accès
- `useMutation(api.payments.recordManualPayment)` - Ajouter accès

---

## Composants suggérés

### AccessBadge
Affiche le statut d'accès avec couleur.

```typescript
type AccessBadgeProps = {
  accessType: "exam" | "training"
  expiresAt: number | null
  daysRemaining: number | null
}

function AccessBadge({ accessType, expiresAt, daysRemaining }: AccessBadgeProps) {
  if (!expiresAt) {
    return <Badge variant="secondary">Inactif</Badge>
  }

  if (daysRemaining && daysRemaining <= 7) {
    return <Badge variant="warning">Expire dans {daysRemaining}j</Badge>
  }

  return <Badge variant="success">Actif - {daysRemaining}j restants</Badge>
}
```

### PricingCard
Carte produit pour la page pricing.

```typescript
type PricingCardProps = {
  product: Product
  currentAccess: AccessStatus | null
  onBuy: (code: string) => void
  isLoading: boolean
}
```

### TransactionRow
Ligne de transaction pour les tableaux.

---

## Gestion des accès dans l'app

### Protéger les routes

Les vérifications d'accès sont déjà faites côté backend dans :
- `exams.startExam` - Vérifie `userAccess` pour "exam"
- `questions.getLearningBankQuestions` - Vérifie `userAccess` pour "training"

Côté frontend, afficher un message approprié :

```typescript
// Dans la page d'examen
const hasExamAccess = useQuery(api.payments.hasExamAccess)

if (hasExamAccess === false) {
  return <UpgradePrompt type="exam" />
}

// Dans la page training
const hasTrainingAccess = useQuery(api.payments.hasTrainingAccess)

if (hasTrainingAccess === false) {
  return <UpgradePrompt type="training" />
}
```

### Composant UpgradePrompt

```typescript
function UpgradePrompt({ type }: { type: "exam" | "training" }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accès requis</CardTitle>
      </CardHeader>
      <CardContent>
        <p>
          {type === "exam"
            ? "Un abonnement est requis pour accéder aux examens simulés."
            : "Un abonnement est requis pour accéder à la banque d'entraînement."}
        </p>
        <Link href="/pricing">
          <Button>Voir les tarifs</Button>
        </Link>
      </CardContent>
    </Card>
  )
}
```

---

## Helpers utiles

### Formatage du prix

```typescript
export function formatPrice(cents: number, currency = "CAD"): string {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

// Usage: formatPrice(5000) → "50,00 $"
```

### Formatage de la date d'expiration

```typescript
import { format, formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

export function formatExpiration(timestamp: number): string {
  return format(new Date(timestamp), "d MMMM yyyy", { locale: fr })
}

export function formatTimeRemaining(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), {
    locale: fr,
    addSuffix: true
  })
}

// Usage:
// formatExpiration(1234567890000) → "15 février 2039"
// formatTimeRemaining(futureTimestamp) → "dans 25 jours"
```

---

## Types TypeScript

```typescript
// Types pour le frontend
export type ProductCode =
  | "exam_access"
  | "training_access"
  | "exam_access_promo"
  | "training_access_promo"

export type AccessType = "exam" | "training"

export type TransactionStatus = "pending" | "completed" | "failed" | "refunded"

export type TransactionType = "stripe" | "manual"

export interface AccessInfo {
  expiresAt: number
  daysRemaining: number
}

export interface MyAccessStatus {
  examAccess: AccessInfo | null
  trainingAccess: AccessInfo | null
}
```

---

## Notes importantes

1. **Webhook** : Le webhook Stripe est configuré sur `/stripe` (convex/http.ts). L'accès est activé automatiquement après paiement réussi.

2. **Admins** : Les utilisateurs avec `role === "admin"` ont toujours accès aux examens et training, pas besoin de payer.

3. **Cumul** : Le temps est cumulé si l'utilisateur a déjà un accès actif.

4. **Idempotence** : Les webhooks sont idempotents (pas de double-activation si Stripe renvoie l'événement).

5. **Devise** : Les prix sont stockés en **cents CAD**. Stripe gère la conversion XAF via Adaptive Pricing.

6. **Test** : Utiliser les cartes de test Stripe :
   - Succès : `4242 4242 4242 4242`
   - Refus : `4000 0000 0000 0002`
