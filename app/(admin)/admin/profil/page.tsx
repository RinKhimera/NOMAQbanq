"use client"

import { Edit, Trash2 } from "lucide-react"
import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ChangePhotoButton } from "./_components/change-photo-button"
import { DeleteAccountDialog } from "./_components/delete-account-dialog"
import { DeletePhotoDialog } from "./_components/delete-photo-dialog"
import { PhotoUpdateDialog } from "./_components/photo-update-dialog"
import { ProfileEditModal } from "./_components/profile-edit-modal"
import { QuickEditSection } from "./_components/quick-edit-section"
import type { UserProfile } from "./_schemas/user-profile.schema"

// Données utilisateur simulées
type AdminUserProfile = UserProfile & { role: "USER" | "ADMIN"; email: string }

const initialProfile: AdminUserProfile = {
  name: "Ngako Daryl",
  username: "mrmiel",
  bio: "Développeur passionnée par les nouvelles technologies et l'innovation. J'aime créer des expériences utilisateur exceptionnelles.",
  avatar: "/placeholder.svg?height=100&width=100",
  role: "ADMIN",
  email: "mbakopngako@gmail.com",
}

export default function ProfilPage() {
  const [profile, setProfile] = useState<AdminUserProfile>(initialProfile)
  const { toast } = useToast()
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>("")
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false)

  const handleProfileSave = (data: UserProfile) => {
    setProfile((prev: AdminUserProfile) => ({ ...prev, ...data }))
    toast({
      title: "Profil mis à jour",
      description: "Vos informations ont été sauvegardées avec succès.",
    })
  }

  const handleFieldSave = (field: string, value: string) => {
    setProfile((prev: AdminUserProfile) => ({ ...prev, [field]: value }))
    toast({
      title: "Information mise à jour",
      description: `${field === "name" ? "Nom" : field === "username" ? "Nom d'utilisateur" : field === "bio" ? "Biographie" : "Photo de profil"} mis à jour avec succès.`,
    })
  }

  const handlePhotoSelected = (file: File) => {
    const url = URL.createObjectURL(file)
    setPhotoPreviewUrl(url)
    setIsPhotoDialogOpen(true)
  }

  const confirmPhotoUpdate = () => {
    setProfile((prev: AdminUserProfile) => ({
      ...prev,
      avatar: photoPreviewUrl,
    }))
    setIsPhotoDialogOpen(false)
    toast({
      title: "Photo mise à jour",
      description: "Votre photo a été modifiée.",
    })
  }
  return (
    <div className="@container flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Profile Header Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="font-bold text-blue-600 dark:text-white">
                Informations du profil
              </span>
              <div className="flex items-center gap-2">
                <ProfileEditModal profile={profile} onSave={handleProfileSave}>
                  <Button variant="outline" size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    Modifier le profil
                  </Button>
                </ProfileEditModal>
                <DeleteAccountDialog
                  onConfirm={() =>
                    toast({
                      title: "Compte supprimé",
                      description: "Votre compte a été supprimé (simulation).",
                    })
                  }
                  trigger={
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer le compte
                    </Button>
                  }
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6 md:flex-row">
              {/* Avatar Section */}
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24 md:h-32 md:w-32">
                  <AvatarImage className="object-cover" src={profile.avatar} />
                  <AvatarFallback className="bg-muted text-2xl dark:bg-gray-900">
                    DB
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Profile Info */}
              <div className="flex-1 space-y-4">
                <Badge
                  variant={"badge"}
                  className="flex w-fit items-center gap-1"
                >
                  {/*   {profile.role === "ADMIN" ? (
                    <Crown className="h-3 w-3" />
                  ) : (
                    <Shield className="h-3 w-3" />
                  )} */}
                  {profile.role}
                </Badge>
                <div>
                  <p className="text-muted-foreground">@{profile.username}</p>
                  <h2 className="text-2xl font-bold">{profile.name}</h2>

                  <p className="text-muted-foreground">{profile.email}</p>
                </div>

                {profile.bio && (
                  <p className="text-sm leading-relaxed">{profile.bio}</p>
                )}

                {/* Photo actions under bio */}
                <div className="flex items-center gap-2">
                  <DeletePhotoDialog
                    trigger={
                      <Button size="sm" variant="destructive" className="">
                        Supprimer la photo
                      </Button>
                    }
                    onConfirm={() => {
                      setProfile((prev: AdminUserProfile) => ({
                        ...prev,
                        avatar: "",
                      }))
                      toast({
                        title: "Photo supprimée",
                        description: "Votre photo de profil a été supprimée.",
                      })
                    }}
                  />
                  <ChangePhotoButton
                    label="Modifier la photo"
                    onSelected={handlePhotoSelected}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Editable Fields */}
        <Card>
          <CardHeader>
            <CardTitle className="font-bold text-blue-600 dark:text-white">
              Modification rapide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <QuickEditSection
              name={profile.name}
              username={profile.username}
              bio={profile.bio || ""}
              onSave={(field, value) => handleFieldSave(field, value)}
            />
          </CardContent>
        </Card>
      </div>
      <PhotoUpdateDialog
        open={isPhotoDialogOpen}
        imageUrl={photoPreviewUrl}
        onOpenChange={setIsPhotoDialogOpen}
        onConfirm={confirmPhotoUpdate}
      />
    </div>
  )
}
