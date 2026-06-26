# Design — Infrastructure d'envoi d'emails transactionnels (AWS SES + React Email)

> Date : 2026-06-18 · Branche : `migration/drizzle-neon` · Statut : design validé, prêt pour plan d'implémentation.

## 1. Contexte & objectif

La migration Convex → Better Auth + Drizzle + Neon a besoin d'envoyer des emails
transactionnels (vérification d'adresse, réinitialisation de mot de passe). Aucun code
email n'existe encore dans le repo (ni `resend`, ni `@react-email/*`, ni `@aws-sdk/*`).
Better Auth est configuré dans `lib/auth.ts` avec `emailAndPassword: { enabled: true }`,
sans envoi d'email.

Le projet a choisi **AWS SES** comme fournisseur d'envoi (free tier généreux, domaines
illimités, ~0,10 $/1000 emails). Objectif de ce lot : poser **l'infrastructure d'envoi
générale et réutilisable**, et la brancher dans les callbacks Better Auth — sans décider
de la politique d'enforcement de la vérification (réservée à une autre session).

## 2. Périmètre

**Dans le périmètre :**

- Module d'envoi réutilisable `email/` (racine) : client SES, helper `sendEmail`, helpers métier.
- Templates React Email (FR) : vérification d'email, réinitialisation de mot de passe.
- Variables d'environnement SES validées (Zod).
- Branchement des 2 callbacks Better Auth (`sendVerificationEmail`, `sendResetPassword`).
- Tests unitaires (vitest) couvrant `send`, `index`, et le rendu des templates.
- Variable de redirection `EMAIL_OVERRIDE_TO` pour tester pendant le sandbox SES.
- Documentation du setup AWS opérationnel (configuration set, suppression auto).

**Hors périmètre (explicite) :**

- Politique de vérification (`requireEmailVerification`) et backfill `emailVerified` des
  users migrés → **décision et implémentation de la session migration**.
- Webhook SNS → DB pour bounces/plaintes (on s'appuie sur la **liste de suppression au
  niveau du compte SES**, automatique). Voir §10.
- Emails non transactionnels (welcome, newsletters, notifications produit).
- Optimisation non bloquante de l'envoi (`waitUntil`) — différée (YAGNI).

## 3. Décisions de cadrage (résolues)

| Sujet               | Décision                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Fournisseur         | AWS SES, région **`us-east-2`** (déduite du MAIL FROM `feedback-smtp.us-east-2.amazonses.com`).           |
| Transport           | SDK **`@aws-sdk/client-sesv2`** (pas SMTP/nodemailer) — natif, léger en serverless.                       |
| Architecture        | Module `email/` dédié (cœur agnostique + adaptateur SES), templates séparés.                              |
| Emplacement         | Dossier **`email/` à la racine** (alias `@/email/*`, `@/*` → `./*`).                                      |
| Bounces/plaintes    | **Liste de suppression compte SES (auto)** + configuration set pour métriques CloudWatch. Pas de webhook. |
| Adresse From        | `NOMAQbanq <noreply@nomaqbanq.ca>` (sous le domaine vérifié `nomaqbanq.ca`).                              |
| Politique de vérif. | **Hors périmètre** — `requireEmailVerification` reste OFF, commenté pour la session migration.            |
| Sandbox             | `EMAIL_OVERRIDE_TO` redirige les envois vers une adresse vérifiée le temps du sandbox.                    |

### Distinction importante (identité vs From vs MAIL FROM)

- **Identité vérifiée** (`nomaqbanq.ca`, dashboard SES) = la permission d'envoyer.
  Vérifier le domaine autorise **toute** adresse `@nomaqbanq.ca` en From, sans la vérifier
  individuellement.
- **`EMAIL_FROM`** (notre code) = le « De : » visible par le destinataire. Une seule valeur
  pour l'app : `NOMAQbanq <noreply@nomaqbanq.ca>`.
- **MAIL FROM personnalisé** (`contact.nomaqbanq.ca`, dashboard SES) = enveloppe / Return-Path
  pour l'alignement SPF et le routage des bounces. Invisible du destinataire, ≠ `EMAIL_FROM`.

## 4. Architecture (arborescence)

```
email/                          # NOUVEAU — server-only
  client.ts                     # SESv2Client singleton (creds explicites + région)
  send.ts                       # sendEmail({ to, subject, react }) — cœur générique
  index.tsx                     # sendVerificationEmail(), sendResetPassword() (JSX → .tsx)
  templates/
    email-layout.tsx            # wrapper de marque partagé (en-tête + pied FR)
    verification-email.tsx      # props { url }
    reset-password-email.tsx    # props { url }

lib/env/schema.ts               # MODIF — + variables SES (optionnelles)
lib/auth.ts                     # MODIF — branche les 2 callbacks
.env.local                      # MODIF — valeurs réelles (gitignore)
.env.example                    # MODIF — placeholders
package.json                    # MODIF — 3 deps runtime
tests/email/                    # NOUVEAU — tests unitaires
```

**Dépendances runtime ajoutées :** `@aws-sdk/client-sesv2`, `@react-email/components`,
`@react-email/render`. Le serveur de preview `react-email` (devDep) est **optionnel** et
**non installé** dans ce lot.

## 5. Variables d'environnement

Ajoutées **optionnelles** dans `buildServerSchema()` (comme `GOOGLE_*`), pour que l'app
démarre en dev/CI sans config SES ; `sendEmail` lève une erreur claire à l'usage si une
valeur requise manque. **Pas de préfixe `AWS_`** (réservé par Vercel/Lambda) — les
credentials sont passés explicitement au client.

| Variable                | Requise pour envoyer | Défaut      | Rôle                                                               |
| ----------------------- | -------------------- | ----------- | ------------------------------------------------------------------ |
| `SES_REGION`            | non                  | `us-east-2` | Région SES.                                                        |
| `SES_ACCESS_KEY_ID`     | oui                  | —           | Clé IAM (policy `ses:SendEmail`).                                  |
| `SES_SECRET_ACCESS_KEY` | oui                  | —           | Secret IAM.                                                        |
| `EMAIL_FROM`            | oui                  | —           | `NOMAQbanq <noreply@nomaqbanq.ca>`.                                |
| `SES_CONFIGURATION_SET` | non                  | —           | Nom du configuration set (métriques CloudWatch).                   |
| `EMAIL_OVERRIDE_TO`     | non                  | —           | Si défini : redirige TOUS les envois vers cette adresse (sandbox). |

Validation : `z.string().optional()` pour toutes (cohérent avec le pattern `stripEmpty`
existant qui traite `""` comme absent).

## 6. Détail des modules

### `email/client.ts`

Singleton au scope module (comme le pool `db/index.ts`). Lève une erreur explicite si
`SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY` manquent. Credentials passés **explicitement**.

```ts
// Server-only. NE PAS importer depuis un composant 'use client'.
import { SESv2Client } from "@aws-sdk/client-sesv2"
import { env } from "@/lib/env/server"

let client: SESv2Client | undefined
export function getSesClient(): SESv2Client {
  if (!env.SES_ACCESS_KEY_ID || !env.SES_SECRET_ACCESS_KEY)
    throw new Error(
      "SES : SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY manquantes",
    )
  client ??= new SESv2Client({
    region: env.SES_REGION ?? "us-east-2",
    credentials: {
      accessKeyId: env.SES_ACCESS_KEY_ID,
      secretAccessKey: env.SES_SECRET_ACCESS_KEY,
    },
  })
  return client
}
```

### `email/send.ts`

Cœur générique. Rend le template en **HTML et texte** (meilleure délivrabilité), applique
la redirection `EMAIL_OVERRIDE_TO` si présente, construit `SendEmailCommand`.

```ts
import { SendEmailCommand } from "@aws-sdk/client-sesv2"
import { render } from "@react-email/render"
import type { ReactElement } from "react"
import { env } from "@/lib/env/server"
import { getSesClient } from "./client"

export interface SendEmailInput {
  to: string
  subject: string
  react: ReactElement
}

export async function sendEmail({
  to,
  subject,
  react,
}: SendEmailInput): Promise<string> {
  if (!env.EMAIL_FROM) throw new Error("EMAIL_FROM manquante")

  // Redirection sandbox : tout part vers EMAIL_OVERRIDE_TO, sujet annoté.
  const recipient = env.EMAIL_OVERRIDE_TO ?? to
  const finalSubject = env.EMAIL_OVERRIDE_TO
    ? `[DEV → ${to}] ${subject}`
    : subject

  const [html, text] = await Promise.all([
    render(react),
    render(react, { plainText: true }),
  ])

  const res = await getSesClient().send(
    new SendEmailCommand({
      FromEmailAddress: env.EMAIL_FROM,
      Destination: { ToAddresses: [recipient] },
      Content: {
        Simple: {
          Subject: { Data: finalSubject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            Text: { Data: text, Charset: "UTF-8" },
          },
        },
      },
      ...(env.SES_CONFIGURATION_SET
        ? { ConfigurationSetName: env.SES_CONFIGURATION_SET }
        : {}),
    }),
  )
  return res.MessageId ?? ""
}
```

> `render` est **async** dans `@react-email/render` (vérifié contre la doc officielle) ;
> l'option `{ plainText: true }` produit la version texte.

### Templates (`email/templates/`)

`email-layout.tsx` : composant wrapper (`Html`/`Head`/`Body`/`Container`) avec en-tête de
marque et pied de page FR, réutilisé par les deux emails. Composants importés de
`@react-email/components`.

Chaque template (FR, avec accents) contient : un titre, un bouton CTA, le **lien de secours
en clair** (au cas où le bouton ne s'affiche pas), une mention d'expiration, et la phrase
« Si vous n'êtes pas à l'origine de cette demande, ignorez ce message. »

- `verification-email.tsx` — props `{ url: string }`.
- `reset-password-email.tsx` — props `{ url: string }`.

### `email/index.tsx`

Helpers métier (fichier `.tsx` car instancie du JSX) :

```tsx
import { sendEmail } from "./send"
import { ResetPasswordEmail } from "./templates/reset-password-email"
import { VerificationEmail } from "./templates/verification-email"

export function sendVerificationEmail({
  to,
  url,
}: {
  to: string
  url: string
}) {
  return sendEmail({
    to,
    subject: "Vérifiez votre adresse courriel — NOMAQbanq",
    react: <VerificationEmail url={url} />,
  })
}

export function sendResetPassword({ to, url }: { to: string; url: string }) {
  return sendEmail({
    to,
    subject: "Réinitialisation de votre mot de passe — NOMAQbanq",
    react: <ResetPasswordEmail url={url} />,
  })
}
```

## 7. Branchement Better Auth (`lib/auth.ts`)

```ts
emailAndPassword: {
  enabled: true,
  // ⚠️ requireEmailVerification : NON défini ici. L'enforcement de la vérification et le
  //    backfill `emailVerified` des users migrés sont gérés par la session migration.
  sendResetPassword: async ({ user, url }) => {
    await sendResetPassword({ to: user.email, url })
  },
},
emailVerification: {
  sendVerificationEmail: async ({ user, url }) => {
    await sendVerificationEmail({ to: user.email, url })
  },
  sendOnSignUp: true,             // l'email part à l'inscription ; n'impose rien sans requireEmailVerification
  autoSignInAfterVerification: true,
},
```

- **`requireEmailVerification` reste OFF** (état actuel) → aucun utilisateur bloqué ; la
  session migration n'aura qu'à activer le flag.
- ❌ **Pas de `advanced.backgroundTasks`** : l'option n'existe pas dans better-auth 1.6.19
  (vérifié dans `node_modules/better-auth/dist`) → la passer casserait `bun run check`.
  On `await` l'envoi directement (≈100–300 ms, erreurs visibles).

## 8. Gestion d'erreurs

- `sendEmail` laisse remonter les erreurs SES (`MessageRejected`, creds invalides…). Elles
  sont **capturées automatiquement par Sentry** (`@sentry/nextjs` déjà instrumenté).
- `sendResetPassword` côté Better Auth conserve sa réponse générique (anti-énumération
  intégrée à Better Auth).
- En sandbox, un envoi vers une adresse non vérifiée renvoie `MessageRejected` — d'où
  l'intérêt de `EMAIL_OVERRIDE_TO` pendant cette phase.

## 9. Tests (`tests/email/`, vitest)

- **`send.test.ts`** : mock du client SES (`getSesClient`) + `@react-email/render` →
  - From/To/Subject/Body (HTML **et** texte) corrects ;
  - `ConfigurationSetName` présent **seulement si** `SES_CONFIGURATION_SET` défini ;
  - `EMAIL_OVERRIDE_TO` : destinataire remplacé + sujet préfixé `[DEV → …]` ;
  - erreur claire si `EMAIL_FROM` manquante.
- **`templates.test.ts`** : rendu réel des 2 templates → contient l'`url` passée et les
  chaînes FR clés (titre, mention d'expiration).
- **`index.test.ts`** : bons sujets + bon template instancié pour chaque helper.

Objectif : rester au-dessus du seuil de couverture 75 % du projet.

## 10. Setup AWS (opérationnel, hors code)

1. **Liste de suppression** : activée par défaut au niveau du compte. SES retire
   automatiquement les hard bounces et plaintes — **aucune action ni code**.
2. **Configuration set** (métriques) — à créer une fois, puis renseigner
   `SES_CONFIGURATION_SET`. Tant que la variable est absente, les envois fonctionnent sans :
   ```bash
   aws sesv2 create-configuration-set --configuration-set-name nomaqbanq-transactional --region us-east-2
   ```
3. **Sortie du sandbox** : demande d'accès production en cours côté AWS (réponse au support
   fournie). Tant qu'on est en sandbox : `EMAIL_OVERRIDE_TO=dixiades@gmail.com` (adresse
   vérifiée) ou utiliser le _mailbox simulator_ (`success@simulator.amazonses.com`, etc.).

## 11. Suite (après ce lot)

- Session migration : décider `requireEmailVerification` + backfill `emailVerified`.
- Éventuel webhook SNS → DB si un besoin produit d'agir sur les bounces apparaît.
- Page UI « Vérifiez votre courriel » + flux de reset côté frontend (hors de ce lot).

## Addendum (2026-06-18) — Décision : clés statiques partout

L'OIDC (fédération Vercel ↔ AWS) a été évalué puis **écarté pour la simplicité**. La clé IAM
étant scopée à `ses:SendEmail` uniquement (rayon d'impact minime, révocable instantanément),
les clés statiques sont acceptables en prod comme en dev. `email/client.ts` utilise donc
uniquement `SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY` (creds passées explicitement).

Déploiement prod (Vercel) : définir `SES_REGION`, `EMAIL_FROM`, `SES_ACCESS_KEY_ID`,
`SES_SECRET_ACCESS_KEY` (et `EMAIL_OVERRIDE_TO` vide) dans les env vars du projet Vercel.
Ne jamais committer `.env.local`.
