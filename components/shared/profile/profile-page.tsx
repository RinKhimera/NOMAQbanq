"use client"

import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  AtSign,
  Calendar,
  Edit,
  Mail,
  MessageSquare,
  Shield,
  User,
} from "lucide-react"
import { ProfileEditModal } from "@/components/shared/profile/profile-edit-modal"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCurrentUser } from "@/hooks/useCurrentUser"

export function ProfilePage() {
  const { currentUser, isLoading } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
        <div className="flex min-h-96 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Chargement du profil...
            </p>
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
    <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres du profil</h1>
        <p className="text-muted-foreground">
          Consultez et modifiez vos informations personnelles
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {/* Profile Header Card */}
        <Card>
          <CardContent>
            <div className="flex flex-col gap-8 md:flex-row md:items-center">
              {/* Avatar Section */}
              <div className="flex flex-col items-center md:items-start">
                <div className="relative">
                  <Avatar className="h-28 w-28 border-4 border-white shadow-2xl md:h-36 md:w-36 dark:border-gray-700">
                    <AvatarImage
                      className="object-cover"
                      src={currentUser.image}
                    />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-3xl font-bold text-white">
                      {getInitials(currentUser.name)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>

              {/* Profile Info */}
              <div className="flex-1 space-y-2 text-center md:text-left">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 md:text-3xl dark:text-white">
                    {currentUser.name}
                  </h1>
                  <p className="text-muted-foreground text-lg">
                    @{currentUser.username || "Non défini"}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {currentUser.email}
                  </p>
                </div>

                {currentUser.bio && (
                  <div className="max-w-2xl">
                    <p className="leading-relaxed text-gray-700 italic dark:text-gray-300">
                      {currentUser.bio}
                    </p>
                  </div>
                )}

                <div>
                  <ProfileEditModal user={currentUser}>
                    <Button size="sm" variant="outline">
                      <Edit className="mr-2 h-5 w-5" />
                      Modifier le profil
                    </Button>
                  </ProfileEditModal>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informations détaillées */}
        <Card className="@container">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
              <User className="h-5 w-5 text-blue-600" />
              Informations détaillées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 @[700px]:grid-cols-2">
              {/* Nom complet */}
              <div className="flex items-start gap-4 rounded-lg p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Nom complet
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {currentUser.name || "Non défini"}
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-4 rounded-lg p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Adresse email
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {currentUser.email}
                  </p>
                </div>
              </div>

              {/* Nom d'utilisateur */}
              <div className="flex items-start gap-4 rounded-lg p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <AtSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Nom d&apos;utilisateur
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    @{currentUser.username || "Non défini"}
                  </p>
                </div>
              </div>

              {/* Rôle */}
              <div className="flex items-start gap-4 rounded-lg p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Rôle
                  </p>
                  <Badge
                    variant={
                      currentUser.role === "admin" ? "default" : "secondary"
                    }
                    className="mt-1 font-semibold"
                  >
                    {currentUser.role === "admin"
                      ? "Administrateur"
                      : "Utilisateur"}
                  </Badge>
                </div>
              </div>

              {/* Date d'inscription */}
              <div className="flex items-start gap-4 rounded-lg p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
                  <Calendar className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Date d&apos;inscription
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {format(
                      new Date(currentUser._creationTime),
                      "dd MMMM yyyy",
                      { locale: fr },
                    )}
                  </p>
                </div>
              </div>

              {/* Biographie */}
              {currentUser.bio && (
                <div>
                  <div className="flex items-start gap-4 rounded-lg p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                      <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Biographie
                      </p>
                      <p className="leading-relaxed text-gray-900 dark:text-white">
                        {currentUser.bio}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
