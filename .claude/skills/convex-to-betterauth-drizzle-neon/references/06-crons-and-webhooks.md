# 06 — Crons + httpActions/webhooks

## `convex/crons.ts` → crons plateforme + route handler protégé

Convex planifie via `crons.ts`. Sur Vercel, un cron = **deux choses** :

1. Une entrée dans `vercel.ts` (source de vérité des schedules) :

   ```ts
   import { type VercelConfig } from '@vercel/config/v1';

   export const config: VercelConfig = {
     framework: 'nextjs',
     crons: [
       { path: '/api/cron/expire-posts', schedule: '0 4 * * *' }, // cron UTC
     ],
   };
   ```

2. Un **route handler** `app/api/cron/expire-posts/route.ts`, **authentifié par `CRON_SECRET`**
   (header `Authorization: Bearer <secret>` injecté par Vercel). Gabarit :
   `assets/cron-route-example.ts.md`.

```ts
import { db } from '@/db';
import { env } from '@/lib/env/server';

export const GET = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  // Fail-closed : sans secret configuré, on refuse tout (jamais « Bearer undefined »).
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ... travail idempotent (UPDATE/DELETE bornés) ...
  return Response.json({ ok: true });
};
```

Notes :

- **Idempotent** : un cron peut rejouer ; écris des requêtes sûres à relancer.
- **Sur une autre plateforme** que Vercel : remplace `vercel.ts` par le planificateur natif
  (GitHub Actions schedule, cron système, Upstash QStash…) qui frappe la même route avec le secret.
- `ctx.scheduler.runAfter(...)` de Convex (tâche différée one-shot) n'a pas d'équivalent natif :
  modélise-le avec une file (Vercel Queues, QStash) ou une colonne `run_at` + un cron qui balaye.

## `httpAction` (`convex/http.ts`) → route handler Next

Chaque `httpAction` devient un fichier `app/api/<chemin>/route.ts` exportant `GET`/`POST`/…

### Webhooks entrants — vérifier la signature AVANT toute logique

C'est l'invariant n°1. Gabarit : `assets/webhook-route-example.ts.md` (Stripe).

```ts
import { headers } from 'next/headers';

import { env } from '@/lib/env/server';
import { stripe } from '@/lib/stripe';

export const POST = async (req: Request) => {
  const body = await req.text(); // corps BRUT (pas req.json()) pour la signature
  const signature = (await headers()).get('stripe-signature');
  if (!signature) return new Response('Signature manquante', { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET ?? '');
  } catch (err) {
    return new Response(`Signature invalide`, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      /* ... */ break;
    }
    default:
      break;
  }
  return Response.json({ received: true });
};
```

Principes (valables pour tout webhook, pas que Stripe) :

- **Lire le corps brut** (`req.text()`), jamais `req.json()` avant vérif (la signature porte sur les
  octets exacts).
- **Vérifier la signature** avec le secret du fournisseur **avant** toute écriture DB.
- **Ne jamais provisionner un accès payant côté client** : la source de vérité est l'événement
  webhook validé (ex. `checkout.session.completed`).
- En dev : `stripe listen --forward-to http://localhost:3000/api/webhooks/stripe`.

## Critère de fin de phase

Les jobs `crons.ts` tournent comme routes protégées par secret, et chaque `httpAction` est une route
handler — les webhooks vérifient la signature avant logique métier.
