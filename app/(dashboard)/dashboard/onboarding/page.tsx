"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
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
import { api } from "@/convex/_generated/api"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { UserFormValues, userFormSchema } from "@/schemas/user"

export default function OnboardingPage() {
  const { currentUser, isLoading } = useCurrentUser()
  const router = useRouter()
  const updateProfile = useMutation(api.users.updateUserProfile)

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: "", username: "", bio: "" },
    mode: "onChange",
  })

  useEffect(() => {
    if (isLoading) return
    if (!currentUser) return
    if (currentUser.username) {
      router.replace("/dashboard")
      return
    }
    form.reset({
      name: currentUser.name || "",
      username: currentUser.username || "",
      bio: currentUser.bio || "",
    })
  }, [currentUser, isLoading, router, form])

  const onSubmit = async (values: UserFormValues) => {
    try {
      const result = await updateProfile({
        name: values.name,
        username: values.username,
        bio: values.bio || undefined,
      })

      if (result.success) {
        toast.success("Profil complété !")
        router.replace("/dashboard")
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour du profil:", error)
      toast.error("Une erreur est survenue lors de la sauvegarde.")
    }
  }

  if (isLoading || currentUser === undefined) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
        <div className="flex min-h-96 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-400">Chargement...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Impossible de charger les informations du profil.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-blue-600">
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
