"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { type MouseEvent, useRef } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
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
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { updateProfile } from "@/features/users/actions"
import { callAction } from "@/lib/safe-action"
import { UserFormValues, userFormSchema } from "@/schemas/user"
import { OnboardingStepper } from "./onboarding-stepper"

const BIO_MAX = 200

type OnboardingFormProps = {
  defaultName: string
  defaultBio: string
}

export const OnboardingForm = ({
  defaultName,
  defaultBio,
}: OnboardingFormProps) => {
  const router = useRouter()
  // Garde de double soumission sans `disabled` : un bouton désactivé perd le
  // focus, qui retomberait sur <body> si l'enregistrement échoue.
  const submitting = useRef(false)

  // Valeurs initiales rendues côté serveur : plus d'effet de préremplissage,
  // donc plus d'état de chargement à afficher. La redirection « déjà onboardé »
  // reste à la charge d'OnboardingGuard, monté dans le layout — un layout ne
  // pouvant pas lire `pathname`, elle ne peut pas remonter côté serveur.
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: defaultName, username: "", bio: defaultBio },
    mode: "onChange",
  })
  const { isSubmitting } = form.formState
  // eslint-disable-next-line react-hooks/incompatible-library
  const bioLength = (form.watch("bio") ?? "").length

  const onSubmit = async (values: UserFormValues) => {
    submitting.current = true
    const result = await callAction(() =>
      updateProfile({
        name: values.name,
        username: values.username,
        bio: values.bio || undefined,
      }),
    )
    submitting.current = false

    if (result.success) {
      toast.success("Profil enregistré, ouverture du tableau de bord…")
      // Un seul geste suffit : le layout SERVEUR (sidebar, prop `hasUsername`
      // du guard) ne se re-rend pas sur une navigation client, et le refresh
      // rejoue lui-même le `redirect()` serveur de la page avec un arbre
      // frais ; à défaut, le guard navigue sur prop fraîche. Un `replace()`
      // enchaîné derrière serait redondant, pas nuisible (#170).
      router.refresh()
    } else {
      toast.error(
        result.error ?? "Une erreur est survenue lors de la sauvegarde.",
      )
    }
  }

  const guardDoubleSubmit = (event: MouseEvent) => {
    if (submitting.current) event.preventDefault()
  }

  return (
    <div className="mx-auto flex w-full max-w-130 flex-col gap-5 py-2 md:py-6">
      <OnboardingStepper current={1} />

      <div className="bg-surface border-line shadow-1 flex flex-col gap-5 rounded-lg border p-8 max-md:p-5">
        <div className="flex flex-col gap-2">
          <h1 className="type-h2 text-ink">Complétez votre profil</h1>
          <p className="text-ink-3 text-[0.9375rem]">
            Avant de continuer, définissez votre identité sur la plateforme.
          </p>
        </div>

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
                  <div className="flex items-baseline justify-between gap-3">
                    <FormLabel>Nom complet</FormLabel>
                    <FormDescription className="text-xs">
                      2 à 50 caractères.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Input
                      placeholder="Marie Dupont"
                      autoComplete="name"
                      maxLength={50}
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
              name="username"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-baseline justify-between gap-3">
                    <FormLabel>Nom d&apos;utilisateur</FormLabel>
                    <FormDescription className="text-right text-xs">
                      3 à 20 caractères : lettres, chiffres et « _ »
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Input
                      placeholder="marie_dupont"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={20}
                      className="max-md:h-11"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value.toLowerCase())
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-baseline justify-between gap-3">
                    <FormLabel>Biographie</FormLabel>
                    <FormDescription className="text-xs">
                      Optionnel ·{" "}
                      <span className="font-mono" data-testid="bio-counter">
                        {bioLength} / {BIO_MAX}
                      </span>
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Textarea
                      rows={3}
                      maxLength={BIO_MAX}
                      placeholder="Parlez brièvement de vous"
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
              aria-disabled={isSubmitting}
              onClick={guardDoubleSubmit}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" />
                  Enregistrement…
                </>
              ) : (
                <>
                  Continuer vers le tableau de bord
                  <ArrowRight aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
