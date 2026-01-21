"use client"

import { motion } from "motion/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  Mail,
  Calendar,
  Shield,
  Copy,
  Check
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface UserInfoCardProps {
  user: {
    _id: string
    name?: string
    email?: string
    username?: string
    image?: string
    role?: "admin" | "user"
    bio?: string
    _creationTime: number
  }
}

export const UserInfoCard = ({ user }: UserInfoCardProps) => {
  const [copied, setCopied] = useState(false)

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(user._id)
    setCopied(true)
    toast.success("ID copié dans le presse-papier")
    setTimeout(() => setCopied(false), 2000)
  }

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/50 dark:bg-gray-900"
    >
      {/* Background gradient */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-slate-600 to-slate-800" />

      <div className="relative">
        {/* Avatar and basic info */}
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-end sm:text-left">
          <Avatar className="h-24 w-24 border-4 border-white shadow-xl dark:border-gray-900">
            <AvatarImage src={user.image} alt={user.name} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-bold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="mt-4 sm:ml-4 sm:mt-0 sm:pb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {user.name || "Utilisateur"}
              </h2>
              <Badge
                className={cn(
                  "rounded-full",
                  user.role === "admin"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                )}
              >
                <Shield className="mr-1 h-3 w-3" />
                {user.role === "admin" ? "Admin" : "Utilisateur"}
              </Badge>
            </div>
            {user.username && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                @{user.username}
              </p>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
              <p className="truncate font-medium text-gray-900 dark:text-white">
                {user.email || "Non défini"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Inscrit le</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {format(new Date(user._creationTime), "d MMMM yyyy", { locale: fr })}
              </p>
            </div>
          </div>
        </div>

        {/* Bio */}
        {user.bio && (
          <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">Biographie</p>
            <p className="mt-1 text-gray-700 dark:text-gray-300">{user.bio}</p>
          </div>
        )}

        {/* User ID */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-gray-200 p-3 dark:border-gray-700">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">ID Utilisateur</p>
            <p className="truncate font-mono text-sm text-gray-700 dark:text-gray-300">
              {user._id}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyId}
            className="ml-2 shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
