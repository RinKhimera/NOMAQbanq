"use client"

import {
  IconAlertCircle,
  IconMail,
  IconSearch,
  IconUsers,
} from "@tabler/icons-react"
import { motion } from "motion/react"
import { useMemo, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ExamAudienceUser } from "@/features/exams/dal"
import { cn } from "@/lib/utils"

/**
 * [Admin] Liste des utilisateurs autorisés d'un examen restreint (page détail).
 * Réutilise le style Card/Avatar de `EligibleCandidatesSection`, avec une
 * recherche locale facultative (la liste est bornée côté DAL).
 */
export function RestrictedAudienceSection({
  audience,
}: {
  audience: ExamAudienceUser[]
}) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredAudience = useMemo(() => {
    if (!searchQuery.trim()) return audience

    const query = searchQuery.toLowerCase()
    return audience.filter(
      (u) =>
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query),
    )
  }, [audience, searchQuery])

  const total = audience.length

  return (
    <Card className="overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-none">
      <CardHeader className="border-b bg-linear-to-r from-teal-500 to-cyan-500 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconUsers className="h-5 w-5" />
            <CardTitle className="text-lg">Utilisateurs autorisés</CardTitle>
          </div>
          <Badge
            variant="secondary"
            className="bg-white/20 text-white hover:bg-white/30"
          >
            {total} utilisateur{total !== 1 && "s"}
          </Badge>
        </div>
        <CardDescription className="text-teal-100">
          Seuls ces utilisateurs peuvent voir et passer cet examen restreint
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {/* Barre de recherche */}
        <div className="border-b border-gray-200/60 bg-gray-50/50 p-4 dark:border-gray-700/60 dark:bg-gray-900/50">
          <div className="relative">
            <IconSearch className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Rechercher par nom ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-4 rounded-2xl bg-amber-100 p-4 dark:bg-amber-900/30"
            >
              <IconAlertCircle className="h-10 w-10 text-amber-600 dark:text-amber-400" />
            </motion.div>
            <p className="font-semibold text-gray-900 dark:text-white">
              Aucun utilisateur autorisé
            </p>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Modifiez l&apos;examen pour ajouter des utilisateurs à
              l&apos;audience.
            </p>
          </div>
        ) : filteredAudience.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <IconSearch className="mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">
              Aucun résultat pour &quot;{searchQuery}&quot;
            </p>
          </div>
        ) : (
          <ScrollArea className="h-100">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredAudience.map((u, index) => (
                <AudienceRow key={u.id} user={u} index={index} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

function AudienceRow({
  user,
  index,
}: {
  user: ExamAudienceUser
  index: number
}) {
  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className={cn(
        "flex items-center gap-4 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50",
      )}
    >
      <Avatar className="h-12 w-12 border-2 border-teal-100 shadow-sm dark:border-teal-800">
        <AvatarFallback className="bg-linear-to-br from-teal-500 to-cyan-500 text-sm font-semibold text-white">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-gray-900 dark:text-white">
          {user.name || "Utilisateur"}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
          <IconMail className="h-3.5 w-3.5" />
          <span className="truncate">{user.email || "-"}</span>
        </div>
      </div>
    </motion.div>
  )
}
