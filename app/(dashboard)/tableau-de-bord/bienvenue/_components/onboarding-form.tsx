"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import { updateProfile } from "@/features/users/actions"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { UserFormValues, userFormSchema } from "@/schemas/user"

type OnboardingFormProps = {
  defaultName: string
  defaultBio: string
}

export const OnboardingForm = ({
  defaultName,
  defaultBio,
}: OnboardingFormProps) => {
  const { refetch } = useCurrentUser()
  const router = useRouter()

  // Valeurs initiales rendues côté serveur : plus d'effet de préremplissage,
  // donc plus d'état de chargement à afficher. La redirection « déjà onboardé »
  // reste à la charge d'OnboardingGuard, monté dans le layout — un layout ne
  // pouvant pas lire `pathname`, elle ne peut pas remonter côté serveur.
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: defaultName, username: "", bio: defaultBio },
    mode: "onChange",
  })

  const onSubmit = async (values: UserFormValues) => {
    try {
      const result = await updateProfile({
        name: values.name,
        username: values.username,
        bio: values.bio || undefined,
      })

      if (result.success) {
        toast.success("Profil complété !")
        await refetch({ query: { disableCookieCache: true } }).catch(() => {})
        router.replace("/tableau-de-bord")
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour du profil:", error)
      toast.error("Une erreur est survenue lors de la sauvegarde.")
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-blue-600">
          Complétez votre profil
        </h1>
        <p className="text-muted-foreground">
          Ajoutez des informations supplémentaires pour améliorer votre
          expérience.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Complétez votre profil</CardTitle>
          <CardDescription>
            Avant de continuer, définissez votre identité sur la plateforme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom complet</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Marie Dupont" {...field} />
                    </FormControl>
                    <FormDescription>
                      Ceci sera visible dans vos statistiques.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom d&apos;utilisateur</FormLabel>
                    <FormControl>
                      <Input placeholder="votre_nom_utilisateur" {...field} />
                    </FormControl>
                    <FormDescription>
                      Public, unique, sans espaces.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder="Parlez brièvement de vous"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Optionnel. 200 caractères maximum.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Enregistrement..." : "Terminer"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
