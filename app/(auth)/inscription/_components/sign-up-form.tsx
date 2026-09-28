"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { AuthCard, AuthDivider } from "@/app/(auth)/_components/auth-card"
import { CheckEmailNotice } from "@/app/(auth)/_components/check-email-notice"
import { GoogleButton } from "@/app/(auth)/_components/google-button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
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
      callbackURL: "/tableau-de-bord",
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
      callbackURL: "/tableau-de-bord",
      errorCallbackURL: "/connexion",
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
    <AuthCard
      title="Créer votre compte"
      description="Gratuit, sans carte de crédit. Accédez à l'évaluation dès aujourd'hui."
    >
      <GoogleButton
        onClick={handleGoogle}
        disabled={isSubmitting || isGoogleLoading}
      />
      <AuthDivider />

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
          className="flex flex-col gap-5"
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
                    autoComplete="new-password"
                    placeholder="••••••••"
                    data-testid="auth-password"
                    className="max-md:h-11"
                    {...field}
                  />
                </FormControl>
                <FormDescription>8 caractères minimum</FormDescription>
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
            {isSubmitting ? "Création…" : "Créer mon compte"}
          </Button>
        </form>
      </Form>

      <p className="text-ink-3 text-center text-sm">
        Vous avez déjà un compte ?{" "}
        <Link
          href="/connexion"
          className="focus-ring text-accent-ink rounded-sm hover:underline"
        >
          Se connecter
        </Link>
      </p>
      <p className="text-ink-3 text-center text-xs leading-normal">
        En créant un compte, vous acceptez les{" "}
        <Link
          href="/conditions"
          className="focus-ring text-accent-ink rounded-sm hover:underline"
        >
          conditions d&apos;utilisation
        </Link>{" "}
        et la{" "}
        <Link
          href="/confidentialite"
          className="focus-ring text-accent-ink rounded-sm hover:underline"
        >
          politique de confidentialité
        </Link>
        .
      </p>
    </AuthCard>
  )
}
