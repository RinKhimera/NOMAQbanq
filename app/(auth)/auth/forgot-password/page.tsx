"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Mail, Shield } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
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
import {
  type ForgotPasswordFormValues,
  forgotPasswordSchema,
} from "@/schemas/auth"

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: "/auth/reset-password",
    })

    if (error) {
      toast.error(error.message ?? "Une erreur est survenue")
      return
    }

    setSubmitted(true)
  }

  const isSubmitting = form.formState.isSubmitting

  return (
    <div className="theme-bg">
      <div className="mx-auto flex min-h-175 max-w-7xl items-center justify-center px-4 pt-8 pb-12 sm:px-6 lg:px-8">
        <div className="relative w-full max-w-md">
          {/* Decorative background elements */}
          <div className="absolute -top-10 -right-10 h-72 w-72 rounded-full bg-linear-to-br from-blue-400/20 to-indigo-400/20 blur-3xl"></div>
          <div className="absolute -bottom-10 -left-10 h-64 w-64 rounded-full bg-linear-to-br from-purple-400/20 to-pink-400/20 blur-3xl"></div>

          {/* Card container */}
          <div className="relative z-10 flex w-full flex-col items-center rounded-3xl border border-white/20 bg-white/60 p-8 shadow-2xl backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-900/60">
            <div className="mb-6 w-full text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-lg">
                <Mail className="h-8 w-8 text-white" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                Mot de passe oublié
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Entrez votre adresse courriel et nous vous enverrons un lien de
                réinitialisation.
              </p>
            </div>

            {submitted ? (
              <div className="w-full space-y-5 text-center">
                <p className="rounded-xl bg-green-50 p-4 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300">
                  Si un compte existe, un courriel a été envoyé.
                </p>
                <Link
                  href="/auth/sign-in"
                  className="inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Retour à la connexion
                </Link>
              </div>
            ) : (
              <div className="w-full space-y-5">
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

                    <Button
                      type="submit"
                      className="w-full rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 font-semibold text-white hover:from-blue-700 hover:to-indigo-700"
                      disabled={isSubmitting}
                      data-testid="auth-submit"
                    >
                      {isSubmitting ? "Envoi..." : "Envoyer le lien"}
                    </Button>
                  </form>
                </Form>

                <p className="text-muted-foreground text-center text-sm">
                  <Link
                    href="/auth/sign-in"
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Retour à la connexion
                  </Link>
                </p>
              </div>
            )}

            {/* Trust indicators */}
            <div className="mt-6 flex w-full items-center justify-center gap-2 border-t border-gray-200 pt-6 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
              <Shield className="h-4 w-4 text-green-500" />
              <span>Lien sécurisé valable une durée limitée</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
