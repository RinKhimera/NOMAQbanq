# Gabarit → `lib/auth.ts`

Instance serveur Better Auth. Adapté du projet source : les `databaseHooks` d'import d'avatar
externe (spécifiques) ont été retirés. Remplace les lignes `// ADAPT:`.

```ts
import { waitUntil } from '@vercel/functions';
// ADAPT: Vercel-only — sinon retire `advanced.backgroundTasks`
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { admin as adminPlugin } from 'better-auth/plugins/admin';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '@/db/schema';
import { sendVerificationEmail } from '@/lib/email';
// ADAPT: ton helper d'envoi (Resend, etc.)
import { env } from '@/lib/env/server';
import { ac, roles } from '@/lib/permissions';

// ADAPT: ou process.env si pas de module env validé

// Better Auth a besoin d'un client transactionnel (Pool pg), pas du driver HTTP Neon.
const db = drizzle(new Pool({ connectionString: env.DATABASE_URL }), { schema });

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  baseURL: env.BETTER_AUTH_URL,

  // storage 'database' (table rate_limit) : le 'memory' par défaut ne survit pas au serverless.
  // ⚠️ Le rate limit n'est actif qu'en production (défaut Better Auth).
  rateLimit: { storage: 'database' },

  emailAndPassword: { enabled: true, requireEmailVerification: true },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ to: user.email, url });
    },
    sendOnSignUp: true,
    sendOnSignIn: true, // requis pour le renvoi auto du lien au sign-in non vérifié
    autoSignInAfterVerification: true,
  },

  advanced: {
    // ADAPT: Vercel-only — l'envoi d'email ne bloque pas la réponse HTTP.
    backgroundTasks: { handler: (promise) => waitUntil(promise) },
  },

  socialProviders: {
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  },

  plugins: [
    // ⚠️ `ac` ET `roles` DOIVENT être passés ici, sinon les permissions sont silencieusement ignorées.
    adminPlugin({ ac, roles, defaultRole: 'user', adminRoles: ['admin'] }), // ADAPT: tes rôles
    // nextCookies DOIT rester le dernier plugin (propage les set-cookie depuis les Server Actions).
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
```

> Handler de route associé — `app/api/auth/[...all]/route.ts` :
>
> ```ts
> import { toNextJsHandler } from 'better-auth/next-js';
>
> import { auth } from '@/lib/auth';
>
> export const { GET, POST } = toNextJsHandler(auth);
> ```
