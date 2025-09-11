"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { AtSign, FileText, Loader2, User } from "lucide-react"
import type React from "react"
import { useEffect, useMemo, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import { Doc } from "@/convex/_generated/dataModel"
import { UserFormValues, userFormSchema } from "@/schemas"

interface ProfileEditModalProps {
  user: Doc<"users">
  children: React.ReactNode
}

export function ProfileEditModal({ user, children }: ProfileEditModalProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const updateProfile = useMutation(api.users.updateUserProfile)

  const initialValues = useMemo(
    () => ({
      name: user.name,
      username: user.username || "",
      bio: user.bio || "",
    }),
    [user.name, user.username, user.bio],
  )

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: initialValues,
  })

  useEffect(() => {
    if (!open) {
      form.reset(initialValues)
    }
  }, [open, initialValues, form])

  const onSubmit = (data: UserFormValues) => {
    startTransition(async () => {
      try {
        const result = await updateProfile({
          name: data.name,
          username: data.username,
          bio: data.bio,
        })

        if (result.success) {
          setOpen(false)
          toast.success("Profil mis à jour avec succès.")
          form.reset(data)
        } else {
          toast.error(result.error)
        }
      } catch (error) {
        console.error("Erreur lors de la mise à jour du profil:", error)
        toast.error("Une erreur est survenue lors de la sauvegarde.")
      }
    })
  }

  // Obtenir les initiales pour l'avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          // fermeture -> reset (déjà géré par effet mais immédiat ici)
          form.reset(initialValues)
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="dark:bg-card bg-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600 dark:text-white">
            <User className="h-5 w-5" />
            Modifier le profil
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.image} alt={user.name} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-xl font-bold text-white">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Name Field */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Nom complet
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Votre nom complet" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Username Field */}
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <AtSign className="h-4 w-4" />
                    {"Nom d\u0027utilisateur"}
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="votre_nom_utilisateur" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Bio Field */}
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Biographie
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Parlez-nous de vous..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-muted-foreground text-xs">
                    {field.value?.length || 0}/200 caractères
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Annuler
              </Button>
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                type="submit"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  "Sauvegarder"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
