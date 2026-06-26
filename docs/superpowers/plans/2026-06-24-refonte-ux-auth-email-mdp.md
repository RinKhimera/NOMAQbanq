# Refonte UX du flux d'authentification email/mot de passe — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le flux email/mot de passe lisible et sans cul-de-sac (guidage Google / reset / vérification) sans affaiblir l'anti-énumération ni `requireEmailVerification`.

**Architecture:** Un helper pur de mapping d'erreurs (`lib/auth-errors.ts`), un composant UI réutilisable « vérifiez votre courriel » (`CheckEmailNotice`), et le câblage de ces deux unités dans les formulaires de connexion/inscription. Un ajustement additif de la config Better Auth (`sendOnSignIn` + rate-limit du renvoi).

**Tech Stack:** Next.js 16 (App Router) · React 19 · Better Auth 1.6.19 (client `authClient`) · shadcn/ui (`Alert`) · react-hook-form + zod · Vitest (happy-dom) · Playwright.

**Spec de référence:** [docs/superpowers/specs/2026-06-24-refonte-ux-auth-email-mdp-design.md](../specs/2026-06-24-refonte-ux-auth-email-mdp-design.md)

**Faits vérifiés (ne pas re-deviner):**

- `error.code` côté client Better Auth = clé `UPPER_SNAKE` (`INVALID_EMAIL_OR_PASSWORD`, `EMAIL_NOT_VERIFIED`, `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`). `error.status` = code HTTP (429 sur rate-limit). Source : `node_modules/@better-auth/core/dist/error/index.mjs`.
- Endpoint resend : `POST /send-verification-email`, body `{ email, callbackURL? }` → client `authClient.sendVerificationEmail({ email, callbackURL })`. Source : `node_modules/better-auth/dist/api/routes/email-verification.mjs:36-42`.
- `sendOnSignIn: true` fait renvoyer le lien automatiquement quand un compte non vérifié tente de se connecter, puis lève `EMAIL_NOT_VERIFIED`. Source : `sign-in.mjs:230-242`.
- `components/ui/alert.tsx` exporte `Alert`/`AlertTitle`/`AlertDescription`, `variant="destructive"`.
- Tests : projet vitest `frontend` (`bun run test`), env happy-dom, `vitest.setup.ts` importe déjà `@testing-library/jest-dom`. `@testing-library/user-event` dispo.
- `app/(auth)/auth/forgot-password/page.tsx:75-77` affiche déjà un message générique (« Si un compte existe, un courriel a été envoyé ») → **aucune tâche** sur cette page (§6 de la spec déjà satisfaite).

---

## Structure des fichiers

| Fichier                                                | Rôle                                       | Action             |
| ------------------------------------------------------ | ------------------------------------------ | ------------------ |
| `lib/auth-errors.ts`                                   | Mapping pur `error → { kind, message }` FR | Créer              |
| `tests/lib/auth-errors.test.ts`                        | Tests unitaires du mapping                 | Créer              |
| `lib/auth.ts`                                          | Config Better Auth                         | Modifier (additif) |
| `app/(auth)/auth/_components/check-email-notice.tsx`   | UI « vérifiez votre courriel » + renvoi    | Créer              |
| `tests/components/auth/check-email-notice.test.tsx`    | Tests composant                            | Créer              |
| `app/(auth)/auth/sign-in/_components/sign-in-form.tsx` | Alerte inline + bascule vérif              | Modifier           |
| `tests/components/auth/sign-in-form.test.tsx`          | Tests form connexion                       | Créer              |
| `app/(auth)/auth/sign-up/_components/sign-up-form.tsx` | Bascule check-email + alerte               | Modifier           |
| `tests/components/auth/sign-up-form.test.tsx`          | Tests form inscription                     | Créer              |
| `e2e/tests/auth-ux.spec.ts`                            | E2E parcours auth                          | Créer              |

---

## Task 1: Helper de mapping d'erreurs `lib/auth-errors.ts`

**Files:**

- Create: `lib/auth-errors.ts`
- Test: `tests/lib/auth-errors.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Create `tests/lib/auth-errors.test.ts` :

```ts
import { describe, expect, it } from "vitest"
import { mapAuthError } from "@/lib/auth-errors"

describe("mapAuthError", () => {
  it("classe EMAIL_NOT_VERIFIED", () => {
    expect(mapAuthError({ code: "EMAIL_NOT_VERIFIED" }).kind).toBe(
      "email_not_verified",
    )
  })

  it("classe INVALID_EMAIL_OR_PASSWORD", () => {
    expect(mapAuthError({ code: "INVALID_EMAIL_OR_PASSWORD" }).kind).toBe(
      "invalid_credentials",
    )
  })

  it("classe le 429 en message de rate-limit", () => {
    const r = mapAuthError({ status: 429 })
    expect(r.kind).toBe("generic")
    expect(r.message).toContain("Trop de tentatives")
  })

  it("classe USER_ALREADY_EXISTS en générique", () => {
    expect(
      mapAuthError({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" }).kind,
    ).toBe("generic")
  })

  it("retombe sur générique pour inconnu / null", () => {
    expect(mapAuthError({ code: "WHATEVER" }).kind).toBe("generic")
    expect(mapAuthError(null).kind).toBe("generic")
    expect(mapAuthError(undefined).message).toBeTruthy()
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `bun run test -- auth-errors`
Expected: FAIL (`Cannot find module '@/lib/auth-errors'`).

- [ ] **Step 3: Implémenter le helper**

Create `lib/auth-errors.ts` :

```ts
// Mapping centralisé des erreurs Better Auth (client) → messages FR.
// `error.code` est la clé UPPER_SNAKE renvoyée par le client ; `error.status`
// porte le code HTTP (429 sur rate-limit). Le `kind` pilote l'UI des forms.

export type AuthErrorKind =
  | "invalid_credentials"
  | "email_not_verified"
  | "generic"

export interface MappedAuthError {
  kind: AuthErrorKind
  message: string
}

interface AuthErrorInput {
  code?: string
  message?: string
  status?: number
}

const GENERIC = "Une erreur est survenue. Veuillez réessayer."

export function mapAuthError(
  error: AuthErrorInput | null | undefined,
): MappedAuthError {
  const code = error?.code
  const status = error?.status

  if (code === "EMAIL_NOT_VERIFIED") {
    return {
      kind: "email_not_verified",
      message: "Votre compte n'est pas encore activé.",
    }
  }

  if (code === "INVALID_EMAIL_OR_PASSWORD") {
    return {
      kind: "invalid_credentials",
      message: "Courriel ou mot de passe incorrect.",
    }
  }

  if (status === 429 || code === "TOO_MANY_REQUESTS") {
    return {
      kind: "generic",
      message: "Trop de tentatives. Veuillez réessayer dans une minute.",
    }
  }

  if (
    code === "USER_ALREADY_EXISTS" ||
    code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
  ) {
    return {
      kind: "generic",
      message:
        "Ce courriel ne peut pas être utilisé pour créer un compte. Essayez de vous connecter.",
    }
  }

  return { kind: "generic", message: GENERIC }
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `bun run test -- auth-errors`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth-errors.ts tests/lib/auth-errors.test.ts
git commit -m "feat(auth): helper FR de mapping des erreurs Better Auth"
```

---

## Task 2: Config Better Auth — `sendOnSignIn` + rate-limit du renvoi

**Files:**

- Modify: `lib/auth.ts`

> Note : `lib/auth.ts` importe `server-only`, le pool pg, SES et l'env — il n'est PAS testable en happy-dom. Vérification par type-check + revue de diff (pas de test unitaire).

- [ ] **Step 1: Ajouter la règle de rate-limit du renvoi**

Dans `lib/auth.ts`, remplacer le bloc `customRules` existant :

```ts
    customRules: {
      "/request-password-reset": { window: 60, max: 3 },
      "/forget-password": { window: 60, max: 3 },
    },
```

par :

```ts
    customRules: {
      "/request-password-reset": { window: 60, max: 3 },
      "/forget-password": { window: 60, max: 3 },
      // Renvoi de vérification : borné comme le reset (anti-spam SES).
      "/send-verification-email": { window: 60, max: 3 },
    },
```

- [ ] **Step 2: Activer `sendOnSignIn`**

Dans le bloc `emailVerification`, remplacer :

```ts
    sendOnSignUp: true, // l'email part à l'inscription ; n'impose rien sans requireEmailVerification
    autoSignInAfterVerification: true,
```

par :

```ts
    sendOnSignUp: true, // l'email part à l'inscription ; n'impose rien sans requireEmailVerification
    autoSignInAfterVerification: true,
    // Compte non vérifié qui tente de se connecter → renvoi auto du lien (puis
    // erreur EMAIL_NOT_VERIFIED). Débloque la « zone grise » des nouveaux inscrits.
    sendOnSignIn: true,
```

- [ ] **Step 3: Vérifier le type-check + lint**

Run: `bun run check`
Expected: PASS (tsc + eslint sans erreur).

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts
git commit -m "feat(auth): sendOnSignIn + rate-limit du renvoi de verification"
```

---

## Task 3: Composant `CheckEmailNotice`

**Files:**

- Create: `app/(auth)/auth/_components/check-email-notice.tsx`
- Test: `tests/components/auth/check-email-notice.test.tsx`

- [ ] **Step 1: Écrire le test qui échoue**

Create `tests/components/auth/check-email-notice.test.tsx` :

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CheckEmailNotice } from "@/app/(auth)/auth/_components/check-email-notice"

const sendVerificationEmail = vi.fn()
const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    sendVerificationEmail: (...args: unknown[]) =>
      sendVerificationEmail(...args),
  },
}))
vi.mock("sonner", () => ({
  toast: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
  },
}))
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("CheckEmailNotice", () => {
  it("affiche l'adresse et le titre en mode signup", () => {
    render(<CheckEmailNotice email="astrid@example.com" mode="signup" />)
    expect(screen.getByTestId("auth-check-email")).toBeInTheDocument()
    expect(screen.getByText(/astrid@example.com/)).toBeInTheDocument()
    expect(
      screen.getByText(/Vérifiez votre boîte courriel/),
    ).toBeInTheDocument()
  })

  it("renvoie le lien puis désactive le bouton (cooldown)", async () => {
    sendVerificationEmail.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<CheckEmailNotice email="a@b.com" mode="verify" />)

    await user.click(screen.getByTestId("auth-resend"))

    expect(sendVerificationEmail).toHaveBeenCalledWith({
      email: "a@b.com",
      callbackURL: "/dashboard",
    })
    expect(toastSuccess).toHaveBeenCalled()
    expect(screen.getByTestId("auth-resend")).toBeDisabled()
  })

  it("affiche un toast d'erreur si le renvoi échoue", async () => {
    sendVerificationEmail.mockResolvedValue({ error: { status: 429 } })
    const user = userEvent.setup()
    render(<CheckEmailNotice email="a@b.com" mode="verify" />)

    await user.click(screen.getByTestId("auth-resend"))

    expect(toastError).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `bun run test -- check-email-notice`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter le composant**

Create `app/(auth)/auth/_components/check-email-notice.tsx` :

```tsx
"use client"

import { Mail } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { mapAuthError } from "@/lib/auth-errors"

const RESEND_COOLDOWN_SECONDS = 45

interface CheckEmailNoticeProps {
  email: string
  mode: "signup" | "verify"
}

export function CheckEmailNotice({ email, mode }: CheckEmailNoticeProps) {
  const [cooldown, setCooldown] = useState(0)
  const [isResending, setIsResending] = useState(false)

  // Décrément du cooldown via interval (pas de Date.now() → ESLint purity OK).
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleResend = async () => {
    setIsResending(true)
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/dashboard",
    })
    setIsResending(false)

    if (error) {
      toast.error(mapAuthError(error).message)
      return
    }

    toast.success("Lien renvoyé. Vérifiez votre boîte courriel.")
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  const title =
    mode === "signup"
      ? "Vérifiez votre boîte courriel"
      : "Confirmez votre adresse courriel"

  return (
    <div
      className="w-full space-y-5 text-center"
      data-testid="auth-check-email"
    >
      <div className="bg-linear-to-br mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl from-blue-500 to-indigo-600 shadow-lg">
        <Mail className="h-7 w-7 text-white" />
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {title}
        </h3>
        {mode === "signup" ? (
          <p className="text-sm text-muted-foreground">
            Si <span className="font-medium">{email}</span> n'est pas déjà
            associée à un compte, un lien de confirmation vient d'y être envoyé.
            Cliquez-le pour activer votre compte.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Votre compte n'est pas encore activé. Nous venons de renvoyer un
            lien de confirmation à <span className="font-medium">{email}</span>.
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full rounded-xl"
        onClick={handleResend}
        disabled={isResending || cooldown > 0}
        data-testid="auth-resend"
      >
        {cooldown > 0 ? `Renvoyer dans ${cooldown} s` : "Renvoyer le lien"}
      </Button>

      {mode === "signup" && (
        <p className="text-sm text-muted-foreground">
          Vous avez déjà un compte ?{" "}
          <Link
            href="/auth/sign-in"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Connectez-vous
          </Link>
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Pas reçu ? Vérifiez vos indésirables.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `bun run test -- check-email-notice`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/(auth)/auth/_components/check-email-notice.tsx tests/components/auth/check-email-notice.test.tsx
git commit -m "feat(auth): composant CheckEmailNotice (verif + renvoi borne)"
```

---

## Task 4: Form de connexion — alerte inline + bascule vérification

**Files:**

- Modify: `app/(auth)/auth/sign-in/_components/sign-in-form.tsx`
- Test: `tests/components/auth/sign-in-form.test.tsx`

- [ ] **Step 1: Écrire le test qui échoue**

Create `tests/components/auth/sign-in-form.test.tsx` :

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SignInForm } from "@/app/(auth)/auth/sign-in/_components/sign-in-form"

const signInEmail = vi.fn()
const signInSocial = vi.fn()
const sendVerificationEmail = vi.fn()
const push = vi.fn()

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: (...a: unknown[]) => signInEmail(...a),
      social: (...a: unknown[]) => signInSocial(...a),
    },
    sendVerificationEmail: (...a: unknown[]) => sendVerificationEmail(...a),
  },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

async function fillAndSubmit() {
  const user = userEvent.setup()
  await user.type(screen.getByTestId("auth-email"), "user@example.com")
  await user.type(screen.getByTestId("auth-password"), "password123")
  await user.click(screen.getByTestId("auth-submit"))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("SignInForm", () => {
  it("redirige vers /dashboard au succès", async () => {
    signInEmail.mockResolvedValue({ error: null })
    render(<SignInForm />)
    await fillAndSubmit()
    expect(push).toHaveBeenCalledWith("/dashboard")
  })

  it("affiche l'alerte actionnable avec lien reset sur identifiants invalides", async () => {
    signInEmail.mockResolvedValue({
      error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 },
    })
    render(<SignInForm />)
    await fillAndSubmit()

    const alert = await screen.findByTestId("auth-error-alert")
    expect(alert).toBeInTheDocument()
    const resetLink = screen.getByRole("link", { name: /Réinitialisez-le/ })
    expect(resetLink).toHaveAttribute("href", "/auth/forgot-password")
  })

  it("bascule vers l'écran de vérification sur EMAIL_NOT_VERIFIED", async () => {
    signInEmail.mockResolvedValue({
      error: { code: "EMAIL_NOT_VERIFIED", status: 403 },
    })
    render(<SignInForm />)
    await fillAndSubmit()

    expect(await screen.findByTestId("auth-check-email")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `bun run test -- sign-in-form`
Expected: FAIL (l'alerte `auth-error-alert` / la bascule `auth-check-email` n'existent pas encore).

- [ ] **Step 3: Réécrire le composant**

Remplacer intégralement `app/(auth)/auth/sign-in/_components/sign-in-form.tsx` par :

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { CheckEmailNotice } from "@/app/(auth)/auth/_components/check-email-notice"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { type MappedAuthError, mapAuthError } from "@/lib/auth-errors"
import { type SignInFormValues, signInSchema } from "@/schemas/auth"

export const SignInForm = () => {
  const router = useRouter()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState<MappedAuthError | null>(null)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<
    string | null
  >(null)

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = async (values: SignInFormValues) => {
    setError(null)
    const { error: signInError } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
      rememberMe: true,
    })

    if (signInError) {
      const mapped = mapAuthError(signInError)
      if (mapped.kind === "email_not_verified") {
        // sendOnSignIn a déjà renvoyé le lien côté serveur.
        setPendingVerificationEmail(values.email)
        return
      }
      setError(mapped)
      return
    }

    toast.success("Connexion réussie")
    router.push("/dashboard")
  }

  const handleGoogle = async () => {
    setIsGoogleLoading(true)
    const { error: googleError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    })
    if (googleError) {
      toast.error(googleError.message ?? "Échec de la connexion avec Google")
      setIsGoogleLoading(false)
    }
  }

  const isSubmitting = form.formState.isSubmitting

  if (pendingVerificationEmail) {
    return <CheckEmailNotice email={pendingVerificationEmail} mode="verify" />
  }

  return (
    <div className="w-full space-y-5">
      <Button
        type="button"
        variant="outline"
        className="w-full rounded-xl"
        onClick={handleGoogle}
        disabled={isSubmitting || isGoogleLoading}
        data-testid="auth-google"
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06L5.84 9.9c.87-2.6 3.3-4.53 6.16-4.53Z"
          />
        </svg>
        Continuer avec Google
      </Button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs text-muted-foreground">ou</span>
        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      </div>

      {error && (
        <Alert variant="destructive" data-testid="auth-error-alert">
          <AlertTitle>Connexion impossible</AlertTitle>
          <AlertDescription>
            {error.kind === "invalid_credentials" ? (
              <div className="space-y-1">
                <p>Vérifiez votre courriel et votre mot de passe.</p>
                <p>
                  Inscrit avec Google ? Utilisez « Continuer avec Google »
                  ci-dessus.
                </p>
                <p>
                  Vous n'avez pas encore de mot de passe ?{" "}
                  <Link
                    href="/auth/forgot-password"
                    className="font-medium underline"
                  >
                    Réinitialisez-le
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <p>{error.message}</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adresse courriel</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="vous@exemple.com"
                    data-testid="auth-email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Mot de passe</FormLabel>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    data-testid="auth-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="bg-linear-to-r w-full rounded-xl from-blue-600 to-indigo-600 font-semibold text-white hover:from-blue-700 hover:to-indigo-700"
            disabled={isSubmitting || isGoogleLoading}
            data-testid="auth-submit"
          >
            {isSubmitting ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Nouveau sur NOMAQbanq ?{" "}
        <Link
          href="/auth/sign-up"
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Créer un compte
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `bun run test -- sign-in-form`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/(auth)/auth/sign-in/_components/sign-in-form.tsx tests/components/auth/sign-in-form.test.tsx
git commit -m "feat(auth): guidage actionnable a la connexion + bascule verification"
```

---

## Task 5: Form d'inscription — bascule check-email + alerte

**Files:**

- Modify: `app/(auth)/auth/sign-up/_components/sign-up-form.tsx`
- Test: `tests/components/auth/sign-up-form.test.tsx`

- [ ] **Step 1: Écrire le test qui échoue**

Create `tests/components/auth/sign-up-form.test.tsx` :

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SignUpForm } from "@/app/(auth)/auth/sign-up/_components/sign-up-form"

const signUpEmail = vi.fn()
const signInSocial = vi.fn()
const sendVerificationEmail = vi.fn()
const push = vi.fn()

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: { email: (...a: unknown[]) => signUpEmail(...a) },
    signIn: { social: (...a: unknown[]) => signInSocial(...a) },
    sendVerificationEmail: (...a: unknown[]) => sendVerificationEmail(...a),
  },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

async function fillAndSubmit() {
  const user = userEvent.setup()
  await user.type(screen.getByTestId("auth-name"), "Marie Dupont")
  await user.type(screen.getByTestId("auth-email"), "marie@example.com")
  await user.type(screen.getByTestId("auth-password"), "password123")
  await user.click(screen.getByTestId("auth-submit"))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("SignUpForm", () => {
  it("bascule vers l'écran de vérification au succès (pas de redirection dashboard)", async () => {
    signUpEmail.mockResolvedValue({ error: null })
    render(<SignUpForm />)
    await fillAndSubmit()

    expect(await screen.findByTestId("auth-check-email")).toBeInTheDocument()
    expect(screen.getByText(/marie@example.com/)).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it("affiche une alerte sur erreur", async () => {
    signUpEmail.mockResolvedValue({
      error: { code: "SOMETHING", status: 400 },
    })
    render(<SignUpForm />)
    await fillAndSubmit()

    expect(await screen.findByTestId("auth-error-alert")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `bun run test -- sign-up-form`
Expected: FAIL (le succès redirige encore vers /dashboard, pas de `auth-check-email`).

- [ ] **Step 3: Réécrire le composant**

Remplacer intégralement `app/(auth)/auth/sign-up/_components/sign-up-form.tsx` par :

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { CheckEmailNotice } from "@/app/(auth)/auth/_components/check-email-notice"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { type MappedAuthError, mapAuthError } from "@/lib/auth-errors"
import { type SignUpFormValues, signUpSchema } from "@/schemas/auth"

export const SignUpForm = () => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState<MappedAuthError | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  })

  const onSubmit = async (values: SignUpFormValues) => {
    setError(null)
    const { error: signUpError } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      callbackURL: "/dashboard",
    })

    if (signUpError) {
      setError(mapAuthError(signUpError))
      return
    }

    // Avec requireEmailVerification, aucune session n'est créée : on n'envoie
    // PAS vers /dashboard (rebond garanti). On affiche « vérifiez votre courriel ».
    setSubmittedEmail(values.email)
  }

  const handleGoogle = async () => {
    setIsGoogleLoading(true)
    const { error: googleError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    })
    if (googleError) {
      setError(mapAuthError(googleError))
      setIsGoogleLoading(false)
    }
  }

  const isSubmitting = form.formState.isSubmitting

  if (submittedEmail) {
    return <CheckEmailNotice email={submittedEmail} mode="signup" />
  }

  return (
    <div className="w-full space-y-5">
      <Button
        type="button"
        variant="outline"
        className="w-full rounded-xl"
        onClick={handleGoogle}
        disabled={isSubmitting || isGoogleLoading}
        data-testid="auth-google"
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06L5.84 9.9c.87-2.6 3.3-4.53 6.16-4.53Z"
          />
        </svg>
        Continuer avec Google
      </Button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs text-muted-foreground">ou</span>
        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      </div>

      {error && (
        <Alert variant="destructive" data-testid="auth-error-alert">
          <AlertTitle>Inscription impossible</AlertTitle>
          <AlertDescription>
            <p>{error.message}</p>
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom complet</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    autoComplete="name"
                    placeholder="Marie Dupont"
                    data-testid="auth-name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adresse courriel</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="vous@exemple.com"
                    data-testid="auth-email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mot de passe</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    data-testid="auth-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="bg-linear-to-r w-full rounded-xl from-green-600 to-emerald-600 font-semibold text-white hover:from-green-700 hover:to-emerald-700"
            disabled={isSubmitting || isGoogleLoading}
            data-testid="auth-submit"
          >
            {isSubmitting ? "Création..." : "Créer mon compte"}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Vous avez déjà un compte ?{" "}
        <Link
          href="/auth/sign-in"
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Se connecter
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `bun run test -- sign-up-form`
Expected: PASS (2 tests).

- [ ] **Step 5: Vérifier l'ensemble (check + suite frontend)**

Run: `bun run check && bun run test`
Expected: tsc + eslint OK ; toute la suite frontend passe.

- [ ] **Step 6: Commit**

```bash
git add app/(auth)/auth/sign-up/_components/sign-up-form.tsx tests/components/auth/sign-up-form.test.tsx
git commit -m "feat(auth): inscription -> ecran verification courriel (fin du rebond dashboard)"
```

---

## Task 6: Tests E2E du parcours auth

**Files:**

- Create: `e2e/tests/auth-ux.spec.ts`

> Ces tests tournent dans un contexte **non authentifié** (override `storageState`). Ils n'exigent pas de seed DB ni de livraison d'email réelle : on vérifie l'UI. **Lancer en ciblé** (pas toute la suite) — cf. préférence E2E courts.

- [ ] **Step 1: Écrire les tests E2E**

Create `e2e/tests/auth-ux.spec.ts` :

```ts
import { expect, test } from "@playwright/test"

// Parcours non authentifiés : on repart d'un état vierge.
test.use({ storageState: { cookies: [], origins: [] } })

test("inscription email/mdp → écran de vérification du courriel", async ({
  page,
}) => {
  await page.goto("/auth/sign-up")

  // Email unique par run pour éviter toute collision côté serveur.
  const unique = `e2e+${Date.now()}@nomaqtest.local`
  await page.getByTestId("auth-name").fill("E2E Test")
  await page.getByTestId("auth-email").fill(unique)
  await page.getByTestId("auth-password").fill("password123")
  await page.getByTestId("auth-submit").click()

  await expect(page.getByTestId("auth-check-email")).toBeVisible()
})

test("connexion avec mauvais mot de passe → alerte actionnable + lien reset", async ({
  page,
}) => {
  await page.goto("/auth/sign-in")

  await page.getByTestId("auth-email").fill("inconnu@nomaqtest.local")
  await page.getByTestId("auth-password").fill("mauvaispass123")
  await page.getByTestId("auth-submit").click()

  const alert = page.getByTestId("auth-error-alert")
  await expect(alert).toBeVisible()
  await expect(
    alert.getByRole("link", { name: /Réinitialisez-le/ }),
  ).toHaveAttribute("href", "/auth/forgot-password")
})
```

- [ ] **Step 2: Lancer les tests E2E ciblés**

Run: `bunx playwright test e2e/tests/auth-ux.spec.ts --project=chromium`
Expected: 2 tests PASS. (Si l'environnement E2E n'est pas prêt — serveur dev / `.env` — noter le blocage et demander avant de lancer plus large.)

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/auth-ux.spec.ts
git commit -m "test(e2e): parcours UX inscription + echec connexion"
```

---

## Self-review (auteur du plan)

- **Couverture spec** : §1 config → Task 2 ; §2 helper → Task 1 ; §3 CheckEmailNotice → Task 3 ; §4 inscription → Task 5 ; §5 connexion → Task 4 ; §6 forgot/reset → déjà conforme (aucune tâche, justifié) ; §7 tests → Tasks 1/3/4/5/6. ✅
- **Placeholders** : aucun (code complet à chaque étape). ✅
- **Cohérence des types** : `MappedAuthError`/`AuthErrorKind`/`mapAuthError` définis en Task 1 et utilisés à l'identique en Tasks 3/4/5. `CheckEmailNotice({ email, mode })` défini en Task 3, appelé en Tasks 4 (`mode="verify"`) et 5 (`mode="signup"`). `data-testid` cohérents (`auth-check-email`, `auth-resend`, `auth-error-alert`). ✅
- **Périmètre** : un seul sous-système (UX auth), un seul plan. ✅

## Notes d'implémentation

- **Ordre conseillé** : Task 1 → 2 → 3 → 4 → 5 → 6 (les forms dépendent du helper et du composant).
- **`bun run test -- <motif>`** filtre par nom de fichier (vitest). Toujours via `bun run test`, jamais `bun test`.
- Ne pas toucher à `requireEmailVerification`, `accountLinking`, ni aux providers : posture sécu inchangée (anti-énumération conservée).
- Cas limite hors périmètre noté dans la spec (lien de vérification expiré → param `?error` sur la page de connexion) : à mettre au backlog, non couvert ici.
