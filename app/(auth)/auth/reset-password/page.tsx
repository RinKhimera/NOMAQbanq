"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Shield } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
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
  type ResetPasswordFormValues,
  resetPasswordSchema,
} from "@/schemas/auth"

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!token) return

    const { error } = await authClient.resetPassword({
      newPassword: values.password,
      token,
    })

    if (error) {
      toast.error(error.message ?? "Échec de la réinitialisation")
      return
    }

    toast.success("Mot de passe réinitialisé avec succès")
    router.push("/auth/sign-in")
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
            {!token ? (
              <div className="w-full space-y-5 text-center">
                <div className="mb-2 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-red-500 to-orange-600 shadow-lg">
                  <AlertTriangle className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Lien invalide
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Ce lien de réinitialisation est invalide ou a expiré. Veuillez
                  en demander un nouveau.
                </p>
                <Link
                  href="/auth/forgot-password"
                  className="inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Demander un nouveau lien
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-6 w-full text-center">
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-lg">
                    <Shield className="h-8 w-8 text-white" />
                  </div>
                  <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                    Nouveau mot de passe
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Choisissez un nouveau mot de passe pour votre compte.
                  </p>
                </div>

                <div className="w-full space-y-5">
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="space-y-4"
                      noValidate
                    >
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nouveau mot de passe</FormLabel>
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

                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmer le mot de passe</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                autoComplete="new-password"
                                placeholder="••••••••"
                                data-testid="auth-confirm-password"
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
                        {isSubmitting
                          ? "Réinitialisation..."
                          : "Réinitialiser le mot de passe"}
                      </Button>
                    </form>
                  </Form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  )
}
