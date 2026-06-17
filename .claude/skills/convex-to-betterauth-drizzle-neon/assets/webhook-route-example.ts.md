# Gabarit → `app/api/webhooks/<provider>/route.ts` (remplace un `httpAction` Convex)

Webhook entrant. **Vérifier la signature sur le corps BRUT avant toute logique métier.** Exemple
Stripe ; le principe vaut pour tout fournisseur.

```ts
import { headers } from 'next/headers';

import { env } from '@/lib/env/server';
import { stripe } from '@/lib/stripe';

// ADAPT: ton client fournisseur

export const POST = async (req: Request) => {
  const body = await req.text(); // ⚠️ corps BRUT, jamais req.json() avant vérif (la signature porte sur les octets)
  const signature = (await headers()).get('stripe-signature');
  if (!signature) return new Response('Signature manquante', { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET ?? '');
  } catch (err) {
    return new Response(`Signature invalide: ${err instanceof Error ? err.message : 'unknown'}`, {
      status: 400,
    });
  }

  // Logique métier APRÈS vérification uniquement.
  switch (event.type) {
    case 'checkout.session.completed': {
      // ADAPT: provisionner l'accès — source de vérité = cet événement validé, jamais le client.
      break;
    }
    case 'customer.subscription.deleted': {
      break;
    }
    default:
      break;
  }

  return Response.json({ received: true });
};
```

Invariants pour tout webhook :

- Lire le corps **brut** (`req.text()`), vérifier la **signature** avec le secret du fournisseur,
  **avant** toute écriture DB.
- Idempotence : un webhook peut être rejoué (dédupliquer par `event.id` si l'effet est sensible).
- Ne jamais provisionner un accès payant côté client : la source de vérité est l'événement validé.
- Dev : `stripe listen --forward-to http://localhost:3000/api/webhooks/stripe`.
