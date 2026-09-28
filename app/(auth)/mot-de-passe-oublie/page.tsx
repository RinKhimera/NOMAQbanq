"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheck, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
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
import {
  type ForgotPasswordFormValues,
  forgotPasswordSchema,
} from "@/schemas/auth"

export default function ForgotPasswordPage() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: "/reinitialiser-mot-de-passe",
    })

    if (error) {
      toast.error(error.message ?? "Une erreur est survenue")
      return
    }

    setSubmittedEmail(values.email)
  }

  const isSubmitting = form.formState.isSubmitting

  if (submittedEmail) {
    return (
      <AuthCard title="Vérifiez votre courriel" icon={MailCheck} focusTitle>
        <p className="text-ink-2 text-[15px] leading-relaxed">
          Si un compte existe pour{" "}
          <strong className="text-ink font-medium">{submittedEmail}</strong>, un
          lien de réinitialisation vient d&apos;être envoyé.
        </p>
        <Button asChild variant="outline" className="w-full max-md:h-11">
          <Link href="/connexion">Retour à la connexion</Link>
        </Button>
        <p className="text-ink-3 text-[13px]">
          Rien reçu après quelques minutes ? Vérifiez vos courriels indésirables
          ou{" "}
          <button
            type="button"
            onClick={() => setSubmittedEmail(null)}
            className="focus-ring text-accent-ink cursor-pointer rounded-sm hover:underline"
          >
            réessayez
          </button>
          .
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Entrez votre adresse courriel et nous vous enverrons un lien de réinitialisation."
    >
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

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
            data-testid="auth-submit"
          >
            {isSubmitting ? "Envoi…" : "Envoyer le lien"}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm">
        <Link
          href="/connexion"
          className="focus-ring text-accent-ink rounded-sm hover:underline"
        >
          Retour à la connexion
        </Link>
      </p>
      <p className="border-line text-ink-3 flex items-center justify-center gap-1.5 border-t pt-4 text-xs">
        <ShieldCheck aria-hidden className="text-success size-3.5" />
        Lien sécurisé valable une durée limitée
      </p>
    </AuthCard>
  )
}
