"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { AtSign, FileText, User, X } from "lucide-react"
import type React from "react"
import { useState } from "react"
import { useForm } from "react-hook-form"
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
import { useToast } from "@/hooks/use-toast"
import {
  type UserProfile,
  userProfileSchema,
} from "../_schemas/user-profile.schema"
import { ChangePhotoButton } from "./change-photo-button"
import { PhotoUpdateDialog } from "./photo-update-dialog"

interface ProfileEditModalProps {
  profile: UserProfile & { role: "USER" | "ADMIN" }
  onSave: (data: UserProfile) => void
  children: React.ReactNode
}

export function ProfileEditModal({
  profile,
  onSave,
  children,
}: ProfileEditModalProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const [avatarPreview, setAvatarPreview] = useState<string>(
    profile.avatar || "",
  )
  const [tempAvatarUrl, setTempAvatarUrl] = useState<string>("")
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false)

  const form = useForm<UserProfile>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      name: profile.name,
      username: profile.username,
      bio: profile.bio || "",
    },
  })

  const onSubmit = (data: UserProfile) => {
    try {
      onSave({ ...data, avatar: avatarPreview || profile.avatar })
      setOpen(false)
      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été sauvegardées avec succès.",
      })
    } catch {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la sauvegarde.",
        variant: "destructive",
      })
    }
  }

  const handlePhotoSelected = (file: File) => {
    const url = URL.createObjectURL(file)
    setTempAvatarUrl(url)
    setIsPhotoDialogOpen(true)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                <AvatarImage
                  src={avatarPreview || "/placeholder.svg"}
                  alt={profile.name}
                />
                <AvatarFallback className="bg-muted text-xl dark:bg-gray-900">
                  DB
                </AvatarFallback>
              </Avatar>

              <div className="flex items-center gap-2">
                <ChangePhotoButton
                  label="Modifier la photo"
                  onSelected={handlePhotoSelected}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-600 text-red-400 hover:bg-red-50"
                  onClick={() => setAvatarPreview("")}
                >
                  Supprimer
                </Button>
              </div>
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
                    {field.value?.length || 0}/160 caractères
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
              >
                <X className="mr-2 h-4 w-4" />
                Annuler
              </Button>
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                type="submit"
                disabled={form.formState.isSubmitting}
              >
                Sauvegarder
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
      <PhotoUpdateDialog
        open={isPhotoDialogOpen}
        imageUrl={tempAvatarUrl}
        onOpenChange={setIsPhotoDialogOpen}
        onConfirm={() => {
          setAvatarPreview(tempAvatarUrl)
          setIsPhotoDialogOpen(false)
          toast({
            title: "Photo sélectionnée",
            description: "Prévisualisation mise à jour.",
          })
        }}
      />
    </Dialog>
  )
}
