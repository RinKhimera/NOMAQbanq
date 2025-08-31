"use client"

import { format } from "date-fns"
import { fr } from "date-fns/locale"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

interface User {
  _id: string
  _creationTime: number
  name: string
  email: string
  image: string
  username?: string
  bio?: string
  role?: "admin" | "user"
  externalId?: string
  tokenIdentifier: string
}

interface UserDetailsDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserDetailsDialog({
  user,
  open,
  onOpenChange,
}: UserDetailsDialogProps) {
  if (!user) return null

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), "PPpp", { locale: fr })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-gray-900">
        <DialogHeader className="items-center">
          <div className="mx-auto">
            <Image
              src={user.image}
              alt={user.name}
              width={80}
              height={80}
              className="mx-auto h-20 w-20 rounded-full object-cover"
            />
          </div>

          <DialogTitle className="text-xl font-semibold">
            {user.name}
          </DialogTitle>

          <div className="flex justify-center">
            <Badge
              variant={user.role === "admin" ? "default" : "secondary"}
              className={
                user.role === "admin"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  : ""
              }
            >
              {user.role === "admin" ? "Administrateur" : "Utilisateur"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <Separator />

          <div className="space-y-3">
            <div>
              <h4 className="text-muted-foreground mb-1 text-sm font-medium">
                Email
              </h4>
              <p className="text-sm">{user.email}</p>
            </div>

            <div>
              <h4 className="text-muted-foreground mb-1 text-sm font-medium">
                Nom d&apos;utilisateur
              </h4>
              <p className="text-sm">
                {user.username ? (
                  <span className="text-blue-600">@{user.username}</span>
                ) : (
                  <span className="text-muted-foreground italic">
                    Non défini
                  </span>
                )}
              </p>
            </div>

            {user.bio && (
              <div>
                <h4 className="text-muted-foreground mb-1 text-sm font-medium">
                  Biographie
                </h4>
                <p className="text-sm">{user.bio}</p>
              </div>
            )}

            <div>
              <h4 className="text-muted-foreground mb-1 text-sm font-medium">
                Date d&apos;inscription
              </h4>
              <p className="text-sm">{formatDate(user._creationTime)}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
