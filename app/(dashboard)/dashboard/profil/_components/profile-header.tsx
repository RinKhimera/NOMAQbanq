"use client"

import { IconCalendar, IconMail } from "@tabler/icons-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { motion, useReducedMotion } from "motion/react"
import { AvatarUploader } from "@/components/shared/avatar-uploader"
import { Badge } from "@/components/ui/badge"
import { Doc } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"

type ProfileHeaderProps = {
  user: Doc<"users">
  onAvatarChange: (newUrl: string) => void
}

export const ProfileHeader = ({ user, onAvatarChange }: ProfileHeaderProps) => {
  const prefersReducedMotion = useReducedMotion()

  const registrationDate = user._creationTime
    ? format(new Date(user._creationTime), "d MMMM yyyy", { locale: fr })
    : null

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
      }

  return (
    <motion.div
      {...motionProps}
      className="relative overflow-hidden rounded-3xl border border-gray-100/80 shadow-sm dark:border-gray-800/80"
    >
      {/* Background gradient with subtle pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/90 via-indigo-50/70 to-violet-50/90 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-violet-950/40" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(99 102 241 / 0.15) 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Decorative blobs */}
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl" />

      {/* Content */}
      <div className="relative px-6 py-8 md:px-8 md:py-10">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Avatar with upload */}
          <motion.div
            initial={prefersReducedMotion ? undefined : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            {/* Glow effect behind avatar */}
            <div className="absolute inset-0 scale-110 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 blur-xl" />

            <div className="relative rounded-2xl bg-white/50 p-1.5 shadow-lg ring-1 ring-white/50 backdrop-blur-sm dark:bg-gray-900/50 dark:ring-gray-800/50">
              <AvatarUploader
                currentAvatarUrl={user.image}
                onAvatarChange={onAvatarChange}
                size="lg"
              />
            </div>

            {/* Camera indicator */}
            <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-2 ring-white dark:bg-gray-800 dark:ring-gray-800">
              <svg
                className="h-4 w-4 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
          </motion.div>

          {/* User info */}
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex-1 text-center sm:text-left"
          >
            {/* Name */}
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">
              {user.name}
            </h1>

            {/* Username */}
            {user.username && (
              <p className="mt-1 text-lg text-blue-600 dark:text-blue-400">
                @{user.username}
              </p>
            )}

            {/* Email */}
            <div className="mt-3 flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 sm:justify-start">
              <IconMail className="h-4 w-4" />
              <span className="text-sm">{user.email}</span>
            </div>

            {/* Badges row */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {/* Role badge */}
              <Badge
                variant="secondary"
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  user.role === "admin"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                )}
              >
                {user.role === "admin" ? "Administrateur" : "Utilisateur"}
              </Badge>

              {/* Registration date */}
              {registrationDate && (
                <Badge
                  variant="outline"
                  className="rounded-full border-gray-200 px-3 py-1 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400"
                >
                  <IconCalendar className="mr-1.5 h-3 w-3" />
                  Membre depuis {registrationDate}
                </Badge>
              )}
            </div>

            {/* Bio preview if exists */}
            {user.bio && (
              <motion.p
                initial={prefersReducedMotion ? undefined : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-4 max-w-md text-sm leading-relaxed text-gray-600 dark:text-gray-400"
              >
                {user.bio}
              </motion.p>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
