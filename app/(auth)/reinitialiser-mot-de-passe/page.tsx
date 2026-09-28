"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Circle, Link2Off } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { AuthCard } from "@/app/(auth)/_components/auth-card"
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
import { cn } from "@/lib/utils"
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
    router.push("/connexion")
  }

  const isSubmitting = form.formState.isSubmitting
  const [password, confirmPassword] = form.watch([
    "password",
    "confirmPassword",
  ])
  const rules = [
    { label: "8 caractères minimum", met: password.length >= 8 },
    {
      label: "Les deux mots de passe correspondent",
      met: password.length > 0 && password === confirmPassword,
    },
  ]

  if (!token) {
    return (
      <AuthCard title="Ce lien a expiré" icon={Link2Off} iconTone="danger">
        <p className="text-ink-2 text-[15px] leading-relaxed">
          Les liens de réinitialisation sont valables une durée limitée et ne
          servent qu&apos;une fois. Demandez-en un nouveau.
        </p>
        <Button asChild className="w-full max-md:h-11">
          <Link href="/mot-de-passe-oublie">Demander un nouveau lien</Link>
        </Button>
        <p className="text-center text-sm">
          <Link
            href="/connexion"
            className="focus-ring text-accent-ink rounded-sm hover:underline"
          >
            Retour à la connexion
          </Link>
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Nouveau mot de passe"
      description="Choisissez un mot de passe que vous n'utilisez pas ailleurs."
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
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
                    className="max-md:h-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <ul className="flex flex-col gap-1.5">
            {rules.map((rule) => (
              <li
                key={rule.label}
                data-state={rule.met ? "met" : "unmet"}
                className={cn(
                  "flex items-center gap-2 text-[13px]",
                  rule.met ? "text-ink-2" : "text-ink-3",
                )}
              >
                {rule.met ? (
                  <Check aria-hidden className="text-success size-3.5" />
                ) : (
                  <Circle aria-hidden className="text-ink-3 size-3.5" />
                )}
                {rule.label}
              </li>
            ))}
          </ul>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
            data-testid="auth-submit"
          >
            {isSubmitting ? "Enregistrement…" : "Enregistrer le mot de passe"}
          </Button>
        </form>
      </Form>
    </AuthCard>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  )
}
