"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { AuthCard, AuthDivider } from "@/app/(auth)/_components/auth-card"
import { CheckEmailNotice } from "@/app/(auth)/_components/check-email-notice"
import { GoogleButton } from "@/app/(auth)/_components/google-button"
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
      if (mapped.kind === "banned") {
        // Page dédiée, sans entrée d'historique : rien à réessayer ici.
        router.replace("/compte-suspendu")
        return
      }
      setError(mapped)
      return
    }

    toast.success("Connexion réussie")
    router.push("/tableau-de-bord")
  }

  const handleGoogle = async () => {
    setIsGoogleLoading(true)
    const { error: googleError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/tableau-de-bord",
      // Sans elle, une erreur du callback OAuth (compte suspendu…) atterrit
      // sur la page d'erreur brute de Better Auth.
      errorCallbackURL: "/connexion",
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
    <AuthCard
      title="Bon retour parmi nous"
      description="Connectez-vous à votre compte pour continuer."
    >
      <GoogleButton
        onClick={handleGoogle}
        disabled={isSubmitting || isGoogleLoading}
      />
      <AuthDivider />

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
                  Vous n&apos;avez pas encore de mot de passe ?{" "}
                  <Link
                    href="/mot-de-passe-oublie"
                    className="focus-ring rounded-sm font-medium underline"
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
          className="flex flex-col gap-5"
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
                    placeholder="vous@exemple.ca"
                    data-testid="auth-email"
                    className="max-md:h-11"
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
                    autoComplete="current-password"
                    placeholder="••••••••"
                    data-testid="auth-password"
                    className="max-md:h-11"
                    {...field}
                  />
                </FormControl>
                <Link
                  href="/mot-de-passe-oublie"
                  className="focus-ring text-accent-ink w-fit rounded-sm text-xs hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center"
                >
                  Mot de passe oublié ?
                </Link>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting || isGoogleLoading}
            data-testid="auth-submit"
          >
            {isSubmitting ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      </Form>

      <p className="text-ink-3 text-center text-sm">
        Pas encore de compte ?{" "}
        <Link
          href="/inscription"
          className="focus-ring text-accent-ink rounded-sm hover:underline"
        >
          Inscrivez-vous gratuitement
        </Link>
      </p>
    </AuthCard>
  )
}
