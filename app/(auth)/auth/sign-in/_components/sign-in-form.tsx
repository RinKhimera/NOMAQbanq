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
        <span className="text-muted-foreground text-xs">ou</span>
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
            className="w-full rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 font-semibold text-white hover:from-blue-700 hover:to-indigo-700"
            disabled={isSubmitting || isGoogleLoading}
            data-testid="auth-submit"
          >
            {isSubmitting ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
      </Form>

      <p className="text-muted-foreground text-center text-sm">
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
