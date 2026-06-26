# SES + React Email Transactional Infra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable `email/` module that sends transactional emails through AWS SES with React Email templates, wired into Better Auth's verification and password-reset callbacks.

**Architecture:** A root `email/` directory with a thin SES client singleton, a generic `sendEmail()` core that renders React Email templates to HTML+text, French templates, and domain helpers (`sendVerificationEmail`, `sendResetPassword`). Better Auth calls the helpers. SES bounces/complaints are handled by SES's automatic account-level suppression list (no webhook). Verification _enforcement_ (`requireEmailVerification` + migrated-user backfill) is intentionally out of scope.

**Tech Stack:** `@aws-sdk/client-sesv2`, `@react-email/components`, `@react-email/render`, Better Auth 1.6.19, Drizzle/Neon, Zod env validation, Vitest.

**Spec:** [docs/superpowers/specs/2026-06-18-ses-react-email-transactional-design.md](../specs/2026-06-18-ses-react-email-transactional-design.md)

**Conventions:**

- Prettier import order is enforced: (1) node/npm, (2) `@/`, (3) relative — blank line between groups.
- Run targeted tests via the npm script: `bun run test <path>` (never `bun test` — Bun's runner breaks `vi.hoisted`/`vi.mocked`).
- All commits should end with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer (omitted from the `-m` examples below for brevity).

---

### Task 1: Install dependencies

**Files:**

- Modify: `package.json` (via `bun add`)

- [ ] **Step 1: Install the three runtime packages**

Run:

```bash
bun add @aws-sdk/client-sesv2 @react-email/components @react-email/render
```

Expected: `package.json` gains the three deps under `dependencies`; `bun.lock` updates; install succeeds.

- [ ] **Step 2: Verify they resolve and type-check still passes**

Run: `bun run type-check`
Expected: PASS (no errors). The packages are installed but not yet imported, so this only confirms the install didn't break types.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "build(email): add aws-sdk sesv2 + react-email deps"
```

---

### Task 2: Configuration — env vars + coverage scope

**Files:**

- Modify: `lib/env/schema.ts:17-26` (add SES fields to `buildServerSchema()`)
- Modify: `.env.example` (append SES section)
- Modify: `.env.local` (append SES section — NOT committed, gitignored)
- Modify: `vitest.config.ts` (coverage include/exclude)

- [ ] **Step 1: Add SES variables to the Zod server schema**

In `lib/env/schema.ts`, inside the `z.object({ ... })` returned by `buildServerSchema()`, after the `GOOGLE_CLIENT_SECRET` line, add:

```ts
    // AWS SES (emails transactionnels) — optionnelles : l'app démarre sans,
    // `sendEmail` lève une erreur claire à l'usage si une valeur requise manque.
    SES_REGION: z.string().optional(),
    SES_ACCESS_KEY_ID: z.string().optional(),
    SES_SECRET_ACCESS_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    SES_CONFIGURATION_SET: z.string().optional(),
    EMAIL_OVERRIDE_TO: z.string().optional(),
```

(`ServerEnv` is `z.infer<...>`, so the type updates automatically.)

- [ ] **Step 2: Append the SES section to `.env.example`**

Add at the end of `.env.example`:

```bash

# =====================
# AWS SES (Emails transactionnels)
# =====================
SES_REGION=us-east-2
SES_ACCESS_KEY_ID=
SES_SECRET_ACCESS_KEY=
EMAIL_FROM=NOMAQbanq <noreply@nomaqbanq.ca>
SES_CONFIGURATION_SET=
# Sandbox uniquement : redirige TOUS les envois vers cette adresse vérifiée. Vider en prod.
EMAIL_OVERRIDE_TO=
```

- [ ] **Step 3: Append the same keys to `.env.local` with working values**

Add at the end of `.env.local` (this file is gitignored — real secrets live here):

```bash

# AWS SES
SES_REGION=us-east-2
SES_ACCESS_KEY_ID=<COLLE_TA_CLE_IAM>
SES_SECRET_ACCESS_KEY=<COLLE_TON_SECRET_IAM>
EMAIL_FROM=NOMAQbanq <noreply@nomaqbanq.ca>
SES_CONFIGURATION_SET=
EMAIL_OVERRIDE_TO=dixiades@gmail.com
```

> The two `<...>` values come from the IAM user created in the AWS console (policy `ses:SendEmail`). `EMAIL_OVERRIDE_TO` is set to the verified sandbox address; leave `SES_CONFIGURATION_SET` empty until the configuration set is created (see spec §10).

- [ ] **Step 4: Update vitest coverage scope**

In `vitest.config.ts`, add `email/**` to the coverage `include` array (after `"schemas/**/*.ts",`):

```ts
        "schemas/**/*.ts",
        "email/**/*.{ts,tsx}",
```

And add `lib/auth.ts` to the coverage `exclude` array (after the `"tests/**",` line) — Better Auth wiring is integration code verified by E2E, consistent with the excluded `convex/http.ts`/`stripe.ts`:

```ts
        "tests/**",
        "lib/auth.ts",
```

- [ ] **Step 5: Verify type-check passes**

Run: `bun run check`
Expected: PASS (tsc + eslint clean).

- [ ] **Step 6: Commit (config files only — .env.local is gitignored)**

```bash
git add lib/env/schema.ts .env.example vitest.config.ts
git commit -m "config(email): add SES env vars + coverage scope for email/"
```

---

### Task 3: SES client singleton

**Files:**

- Create: `email/client.ts`
- Test: `tests/email/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/email/client.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const { sesCtor } = vi.hoisted(() => ({ sesCtor: vi.fn() }))
const { envMock } = vi.hoisted(() => ({
  envMock: { current: {} as Record<string, string | undefined> },
}))

vi.mock("@aws-sdk/client-sesv2", () => ({ SESv2Client: sesCtor }))
vi.mock("@/lib/env/server", () => ({
  get env() {
    return envMock.current
  },
}))

beforeEach(() => {
  sesCtor.mockClear()
  vi.resetModules()
})

describe("getSesClient", () => {
  it("throws when credentials are missing", async () => {
    envMock.current = { EMAIL_FROM: "x@y.z" }
    const { getSesClient } = await import("@/email/client")
    expect(() => getSesClient()).toThrow(/SES_ACCESS_KEY_ID/)
  })

  it("creates a client with region and explicit credentials", async () => {
    envMock.current = {
      SES_REGION: "us-east-2",
      SES_ACCESS_KEY_ID: "AKIA_TEST",
      SES_SECRET_ACCESS_KEY: "secret_test",
    }
    const { getSesClient } = await import("@/email/client")
    getSesClient()
    expect(sesCtor).toHaveBeenCalledWith({
      region: "us-east-2",
      credentials: { accessKeyId: "AKIA_TEST", secretAccessKey: "secret_test" },
    })
  })

  it("reuses the same instance (singleton)", async () => {
    envMock.current = { SES_ACCESS_KEY_ID: "a", SES_SECRET_ACCESS_KEY: "b" }
    const { getSesClient } = await import("@/email/client")
    expect(getSesClient()).toBe(getSesClient())
    expect(sesCtor).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test tests/email/client.test.ts`
Expected: FAIL — cannot resolve `@/email/client` (file does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `email/client.ts`:

```ts
// Server-only. NE PAS importer depuis un composant 'use client'.
import { SESv2Client } from "@aws-sdk/client-sesv2"
import { env } from "@/lib/env/server"

let client: SESv2Client | undefined

export function getSesClient(): SESv2Client {
  if (!env.SES_ACCESS_KEY_ID || !env.SES_SECRET_ACCESS_KEY) {
    throw new Error(
      "SES : SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY manquantes",
    )
  }
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test tests/email/client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add email/client.ts tests/email/client.test.ts
git commit -m "feat(email): SES client singleton with explicit credentials"
```

---

### Task 4: Generic `sendEmail` core

**Files:**

- Create: `email/send.ts`
- Test: `tests/email/send.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/email/send.test.ts`:

```ts
import { createElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { sendEmail } from "@/email/send"

const { sendSpy, renderSpy, commandSpy } = vi.hoisted(() => ({
  sendSpy: vi.fn(),
  renderSpy: vi.fn(),
  commandSpy: vi.fn(),
}))
const { envMock } = vi.hoisted(() => ({
  envMock: { current: {} as Record<string, string | undefined> },
}))

vi.mock("@/email/client", () => ({ getSesClient: () => ({ send: sendSpy }) }))
vi.mock("@react-email/render", () => ({ render: renderSpy }))
vi.mock("@/lib/env/server", () => ({
  get env() {
    return envMock.current
  },
}))
vi.mock("@aws-sdk/client-sesv2", () => ({
  SendEmailCommand: class {
    constructor(input: unknown) {
      commandSpy(input)
    }
  },
}))

interface SesInput {
  FromEmailAddress: string
  Destination: { ToAddresses: string[] }
  Content: {
    Simple: {
      Subject: { Data: string }
      Body: { Html: { Data: string }; Text: { Data: string } }
    }
  }
  ConfigurationSetName?: string
}

const react = createElement("div", null, "x")
const lastInput = () => commandSpy.mock.calls[0]?.[0] as SesInput

beforeEach(() => {
  sendSpy.mockReset().mockResolvedValue({ MessageId: "msg-123" })
  renderSpy
    .mockReset()
    .mockImplementation((_el: unknown, opts?: { plainText?: boolean }) =>
      Promise.resolve(opts?.plainText ? "texte brut" : "<p>html</p>"),
    )
  commandSpy.mockReset()
  envMock.current = { EMAIL_FROM: "NOMAQbanq <noreply@nomaqbanq.ca>" }
})

describe("sendEmail", () => {
  it("builds the SES command with HTML and text bodies", async () => {
    const id = await sendEmail({
      to: "user@example.com",
      subject: "Sujet",
      react,
    })
    expect(id).toBe("msg-123")
    const input = lastInput()
    expect(input.FromEmailAddress).toBe("NOMAQbanq <noreply@nomaqbanq.ca>")
    expect(input.Destination.ToAddresses).toEqual(["user@example.com"])
    expect(input.Content.Simple.Subject.Data).toBe("Sujet")
    expect(input.Content.Simple.Body.Html.Data).toBe("<p>html</p>")
    expect(input.Content.Simple.Body.Text.Data).toBe("texte brut")
    expect(input.ConfigurationSetName).toBeUndefined()
  })

  it("includes ConfigurationSetName only when set", async () => {
    envMock.current.SES_CONFIGURATION_SET = "nomaqbanq-transactional"
    await sendEmail({ to: "user@example.com", subject: "Sujet", react })
    expect(lastInput().ConfigurationSetName).toBe("nomaqbanq-transactional")
  })

  it("redirects to EMAIL_OVERRIDE_TO and annotates the subject", async () => {
    envMock.current.EMAIL_OVERRIDE_TO = "dixiades@gmail.com"
    await sendEmail({ to: "real@user.com", subject: "Sujet", react })
    const input = lastInput()
    expect(input.Destination.ToAddresses).toEqual(["dixiades@gmail.com"])
    expect(input.Content.Simple.Subject.Data).toBe(
      "[DEV → real@user.com] Sujet",
    )
  })

  it("throws when EMAIL_FROM is missing", async () => {
    envMock.current = {}
    await expect(
      sendEmail({ to: "user@example.com", subject: "Sujet", react }),
    ).rejects.toThrow(/EMAIL_FROM/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test tests/email/send.test.ts`
Expected: FAIL — cannot resolve `@/email/send`.

- [ ] **Step 3: Write the implementation**

Create `email/send.ts`:

```ts
// Server-only. NE PAS importer depuis un composant 'use client'.
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
  if (!env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM manquante")
  }

  // Sandbox : redirige tous les envois vers une adresse vérifiée, sujet annoté.
  const recipient = env.EMAIL_OVERRIDE_TO ?? to
  const finalSubject = env.EMAIL_OVERRIDE_TO
    ? `[DEV → ${to}] ${subject}`
    : subject

  const [html, text] = await Promise.all([
    render(react),
    render(react, { plainText: true }),
  ])

  const response = await getSesClient().send(
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

  return response.MessageId ?? ""
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test tests/email/send.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add email/send.ts tests/email/send.test.ts
git commit -m "feat(email): generic sendEmail core (render html+text, override, config set)"
```

---

### Task 5: React Email templates

**Files:**

- Create: `email/templates/email-layout.tsx`
- Create: `email/templates/verification-email.tsx`
- Create: `email/templates/reset-password-email.tsx`
- Test: `tests/email/templates.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/email/templates.test.ts`:

```ts
import { render } from "@react-email/render"
import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { ResetPasswordEmail } from "@/email/templates/reset-password-email"
import { VerificationEmail } from "@/email/templates/verification-email"

describe("email templates", () => {
  it("verification email contains the url and FR copy", async () => {
    const html = await render(
      createElement(VerificationEmail, {
        url: "https://nomaqbanq.ca/v?token=abc",
      }),
    )
    expect(html).toContain("https://nomaqbanq.ca/v?token=abc")
    expect(html).toContain("Vérifier mon adresse")
  })

  it("reset password email contains the url and FR copy", async () => {
    const html = await render(
      createElement(ResetPasswordEmail, {
        url: "https://nomaqbanq.ca/r?token=xyz",
      }),
    )
    expect(html).toContain("https://nomaqbanq.ca/r?token=xyz")
    expect(html).toContain("mot de passe")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test tests/email/templates.test.ts`
Expected: FAIL — cannot resolve the template modules.

- [ ] **Step 3: Create the shared layout**

Create `email/templates/email-layout.tsx`:

```tsx
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import type { ReactNode } from "react"

export function EmailLayout({
  preview,
  children,
}: {
  preview: string
  children: ReactNode
}) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{ backgroundColor: "#f4f4f5", fontFamily: "Arial, sans-serif" }}
      >
        <Container
          style={{ margin: "0 auto", maxWidth: "480px", padding: "24px" }}
        >
          <Section>
            <Text
              style={{ fontSize: "20px", fontWeight: "bold", color: "#18181b" }}
            >
              NOMAQbanq
            </Text>
          </Section>
          {children}
          <Hr style={{ borderColor: "#e4e4e7", margin: "24px 0" }} />
          <Text style={{ fontSize: "12px", color: "#71717a" }}>
            NOMAQbanq — Préparation à l&apos;EACMC Partie I.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 4: Create the verification template**

Create `email/templates/verification-email.tsx`:

```tsx
import { Button, Link, Section, Text } from "@react-email/components"
import { EmailLayout } from "./email-layout"

export function VerificationEmail({ url }: { url: string }) {
  return (
    <EmailLayout preview="Confirmez votre adresse courriel">
      <Section>
        <Text style={{ fontSize: "16px", color: "#18181b" }}>
          Bienvenue ! Confirmez votre adresse courriel pour activer votre
          compte.
        </Text>
        <Button
          href={url}
          style={{
            backgroundColor: "#18181b",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "6px",
            fontSize: "14px",
            display: "inline-block",
          }}
        >
          Vérifier mon adresse
        </Button>
        <Text style={{ fontSize: "13px", color: "#52525b" }}>
          Ou copiez ce lien dans votre navigateur :{" "}
          <Link href={url}>{url}</Link>
        </Text>
        <Text style={{ fontSize: "13px", color: "#71717a" }}>
          Ce lien expirera bientôt. Si vous n&apos;êtes pas à l&apos;origine de
          cette demande, ignorez ce message.
        </Text>
      </Section>
    </EmailLayout>
  )
}
```

- [ ] **Step 5: Create the reset-password template**

Create `email/templates/reset-password-email.tsx`:

```tsx
import { Button, Link, Section, Text } from "@react-email/components"
import { EmailLayout } from "./email-layout"

export function ResetPasswordEmail({ url }: { url: string }) {
  return (
    <EmailLayout preview="Réinitialisation de votre mot de passe">
      <Section>
        <Text style={{ fontSize: "16px", color: "#18181b" }}>
          Vous avez demandé à réinitialiser votre mot de passe. Cliquez
          ci-dessous pour en choisir un nouveau.
        </Text>
        <Button
          href={url}
          style={{
            backgroundColor: "#18181b",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "6px",
            fontSize: "14px",
            display: "inline-block",
          }}
        >
          Réinitialiser mon mot de passe
        </Button>
        <Text style={{ fontSize: "13px", color: "#52525b" }}>
          Ou copiez ce lien dans votre navigateur :{" "}
          <Link href={url}>{url}</Link>
        </Text>
        <Text style={{ fontSize: "13px", color: "#71717a" }}>
          Ce lien expirera bientôt. Si vous n&apos;êtes pas à l&apos;origine de
          cette demande, ignorez ce message ; votre mot de passe reste inchangé.
        </Text>
      </Section>
    </EmailLayout>
  )
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bun run test tests/email/templates.test.ts`
Expected: PASS (2 tests).

> If the test fails to resolve `@react-email/components` due to ESM, add `"@react-email/components"` and `"@react-email/render"` to the frontend project's `test.server.deps.inline` array in `vitest.config.ts`, then re-run.

- [ ] **Step 7: Commit**

```bash
git add email/templates tests/email/templates.test.ts
git commit -m "feat(email): FR verification + reset-password React Email templates"
```

---

### Task 6: Domain helpers

**Files:**

- Create: `email/index.tsx`
- Test: `tests/email/index.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/email/index.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { sendResetPassword, sendVerificationEmail } from "@/email"

const { sendEmailSpy } = vi.hoisted(() => ({ sendEmailSpy: vi.fn() }))
vi.mock("@/email/send", () => ({ sendEmail: sendEmailSpy }))

interface Arg {
  to: string
  subject: string
  react: unknown
}
const firstArg = () => sendEmailSpy.mock.calls[0]?.[0] as Arg

beforeEach(() => {
  sendEmailSpy.mockReset().mockResolvedValue("msg-1")
})

describe("email domain helpers", () => {
  it("sendVerificationEmail uses the verification subject and a template element", async () => {
    await sendVerificationEmail({ to: "u@x.com", url: "https://x/v" })
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
    const arg = firstArg()
    expect(arg.to).toBe("u@x.com")
    expect(arg.subject).toContain("Vérifiez votre adresse")
    expect(arg.react).toBeTruthy()
  })

  it("sendResetPassword uses the reset subject", async () => {
    await sendResetPassword({ to: "u@x.com", url: "https://x/r" })
    expect(firstArg().subject).toContain("Réinitialisation")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test tests/email/index.test.ts`
Expected: FAIL — cannot resolve `@/email`.

- [ ] **Step 3: Write the implementation**

Create `email/index.tsx`:

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

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test tests/email/index.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add email/index.tsx tests/email/index.test.ts
git commit -m "feat(email): sendVerificationEmail + sendResetPassword domain helpers"
```

---

### Task 7: Wire into Better Auth

**Files:**

- Modify: `lib/auth.ts`

- [ ] **Step 1: Add the email helper import**

In `lib/auth.ts`, add to the `@/` import group (alphabetical — between `@/db/schema` and `@/lib/env/server`):

```ts
import { sendResetPassword, sendVerificationEmail } from "@/email"
```

The import block becomes:

```ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { sendResetPassword, sendVerificationEmail } from "@/email"
import { env } from "@/lib/env/server"
```

- [ ] **Step 2: Add the callbacks to the `betterAuth({ ... })` config**

Replace the current `emailAndPassword: { enabled: true },` line with the block below, and add the `emailVerification` block right after it (before `socialProviders`):

```ts
  emailAndPassword: {
    enabled: true,
    // ⚠️ requireEmailVerification : NON défini ici. L'enforcement de la vérification et
    //    le backfill `emailVerified` des users migrés sont gérés par la session migration.
    sendResetPassword: async ({ user, url }) => {
      await sendResetPassword({ to: user.email, url })
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ to: user.email, url })
    },
    sendOnSignUp: true, // l'email part à l'inscription ; n'impose rien sans requireEmailVerification
    autoSignInAfterVerification: true,
  },
```

For reference, the full file should read:

```ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { sendResetPassword, sendVerificationEmail } from "@/email"
import { env } from "@/lib/env/server"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // ⚠️ requireEmailVerification : NON défini ici. L'enforcement de la vérification et
    //    le backfill `emailVerified` des users migrés sont gérés par la session migration.
    sendResetPassword: async ({ user, url }) => {
      await sendResetPassword({ to: user.email, url })
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ to: user.email, url })
    },
    sendOnSignUp: true, // l'email part à l'inscription ; n'impose rien sans requireEmailVerification
    autoSignInAfterVerification: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
})

export type Session = typeof auth.$Infer.Session
```

- [ ] **Step 3: Verify type-check + lint pass**

Run: `bun run check`
Expected: PASS. (Confirms the callback signatures `{ user, url }`, `sendOnSignUp`, and `autoSignInAfterVerification` match better-auth 1.6.19's types — `advanced.backgroundTasks` is deliberately NOT used because it does not exist in this version.)

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts
git commit -m "feat(auth): send verification + reset emails via SES"
```

---

### Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full email test suite**

Run: `bun run test tests/email`
Expected: PASS — all email tests (client 3, send 4, templates 2, index 2 = 11).

- [ ] **Step 2: Run type-check + lint**

Run: `bun run check`
Expected: PASS (tsc clean, eslint `--max-warnings 0` clean).

- [ ] **Step 3: Run the full test suite with coverage**

Run: `bun run test:coverage`
Expected: PASS, all projects green, coverage thresholds (75% statements/branches/functions/lines) still met. `email/**` is now measured and should be well above threshold; `lib/auth.ts` is excluded.

> If `email/**` reports below 75% on any metric, identify the uncovered lines from the report and add the missing assertion to the corresponding `tests/email/*.test.ts` file.

- [ ] **Step 4: Manual sandbox smoke test (optional, requires real SES creds in `.env.local`)**

With `EMAIL_OVERRIDE_TO=dixiades@gmail.com` set, trigger a password-reset from the running app (`bun dev`) for any account. Expected: an email arrives at `dixiades@gmail.com` with subject `[DEV → <real-address>] Réinitialisation de votre mot de passe — NOMAQbanq`. If SES returns `MessageRejected`, confirm the From domain is verified and the recipient override is a verified sandbox identity.

- [ ] **Step 5: No commit needed** (verification only; any coverage fix from Step 3 is committed with its test file).

---

## Out of scope (do NOT implement here)

- `requireEmailVerification` enforcement + `emailVerified` backfill for migrated users → migration session.
- SNS → DB bounce/complaint webhook → SES account-level suppression list handles it automatically.
- Welcome / marketing / notification emails.
- Non-blocking send via `waitUntil`.
- Frontend "verify your email" page and reset-password UI flow.
