"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { IconKey, IconShield } from "@tabler/icons-react"
import { motion, useReducedMotion } from "motion/react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  type ChangePasswordFormValues,
  changePasswordSchema,
} from "@/schemas/auth"

export const ProfileSecurity = () => {
  const prefersReducedMotion = useReducedMotion()

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const onSubmit = async (values: ChangePasswordFormValues) => {
    const { error } = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      revokeOtherSessions: true,
    })

    if (error) {
      toast.error(error.message ?? "Échec de la modification du mot de passe")
      return
    }

    toast.success("Mot de passe modifié avec succès")
    form.reset()
  }

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.5,
          delay: 0.2,
          ease: [0.16, 1, 0.3, 1] as const,
        },
      }

  const isSubmitting = form.formState.isSubmitting

  return (
    <motion.div {...motionProps}>
      <Card className="overflow-hidden rounded-2xl border-gray-100 shadow-sm dark:border-gray-800">
        <CardHeader className="block border-b border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/20">
              <IconShield className="h-5 w-5 text-white" />
            </div>
            <span className="font-display font-semibold text-gray-900 dark:text-white">
              Sécurité
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6">
          <div className="rounded-xl bg-linear-to-br from-orange-50 to-amber-50/50 p-5 dark:from-orange-950/30 dark:to-amber-950/20">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/40">
                <IconKey className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Mot de passe
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  Modifiez votre mot de passe ci-dessous. Par sécurité, vos
                  autres sessions seront déconnectées.
                </p>

                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="mt-4 space-y-4"
                    noValidate
                  >
                    <FormField
                      control={form.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mot de passe actuel</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              autoComplete="current-password"
                              placeholder="••••••••"
                              data-testid="security-current-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nouveau mot de passe</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              autoComplete="new-password"
                              placeholder="••••••••"
                              data-testid="security-new-password"
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
                          <FormLabel>
                            Confirmer le nouveau mot de passe
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              autoComplete="new-password"
                              placeholder="••••••••"
                              data-testid="security-confirm-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      variant="outline"
                      disabled={isSubmitting}
                      className="rounded-xl border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/40"
                      data-testid="security-submit"
                    >
                      <IconKey className="mr-2 h-4 w-4" />
                      {isSubmitting
                        ? "Modification..."
                        : "Modifier le mot de passe"}
                    </Button>
                  </form>
                </Form>
              </div>
            </div>
          </div>

          {/* TODO(Phase 7): gérer les comptes connectés (Google, etc.) — pas
              d'équivalent direct Better Auth dans cette phase. */}
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-5 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white">
              Comptes connectés
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              La gestion des comptes connectés (Google) sera disponible
              prochainement.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
