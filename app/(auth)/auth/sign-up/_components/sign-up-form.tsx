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
        <span className="text-muted-foreground text-xs">ou</span>
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
            className="w-full rounded-xl bg-linear-to-r from-green-600 to-emerald-600 font-semibold text-white hover:from-green-700 hover:to-emerald-700"
            disabled={isSubmitting || isGoogleLoading}
            data-testid="auth-submit"
          >
            {isSubmitting ? "Création..." : "Créer mon compte"}
          </Button>
        </form>
      </Form>

      <p className="text-muted-foreground text-center text-sm">
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
