"use client"

import { useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { motion } from "motion/react"
import {
  IconUsers,
  IconAlertCircle,
  IconSearch,
  IconClock,
  IconMail,
} from "@tabler/icons-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"
import { useMemo, useState } from "react"

export function EligibleCandidatesSection() {
  const [searchQuery, setSearchQuery] = useState("")

  const eligibleCandidates = useQuery(api.users.getUsersWithActiveExamAccess, {
    limit: 100,
  })

  const isLoading = eligibleCandidates === undefined

  const filteredCandidates = useMemo(() => {
    if (!eligibleCandidates) return []
    if (!searchQuery.trim()) return eligibleCandidates

    const query = searchQuery.toLowerCase()
    return eligibleCandidates.filter(
      (c) =>
        c.user.name?.toLowerCase().includes(query) ||
        c.user.email?.toLowerCase().includes(query) ||
        c.user.username?.toLowerCase().includes(query),
    )
  }, [eligibleCandidates, searchQuery])

  if (isLoading) {
    return (
      <Card className="overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-none">
        <CardHeader className="border-b bg-gradient-to-r from-teal-500 to-cyan-500 text-white">
          <div className="flex items-center gap-2">
            <IconUsers className="h-5 w-5" />
            <CardTitle className="text-lg">Candidats éligibles</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex animate-pulse items-center gap-4 rounded-xl bg-gray-100 p-4 dark:bg-gray-800"
              >
                <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-3 w-48 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const total = eligibleCandidates?.length ?? 0

  return (
    <Card className="overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-none">
      <CardHeader className="border-b bg-gradient-to-r from-teal-500 to-cyan-500 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconUsers className="h-5 w-5" />
            <CardTitle className="text-lg">Candidats éligibles</CardTitle>
          </div>
          <Badge
            variant="secondary"
            className="bg-white/20 text-white hover:bg-white/30"
          >
            {total} utilisateur{total !== 1 && "s"}
          </Badge>
        </div>
        <CardDescription className="text-teal-100">
          Utilisateurs avec un accès exam actif pouvant participer à cet examen
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {/* Barre de recherche */}
        <div className="border-b border-gray-200/60 bg-gray-50/50 p-4 dark:border-gray-700/60 dark:bg-gray-900/50">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
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
              Aucun candidat éligible
            </p>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Les utilisateurs doivent avoir un accès exam actif pour pouvoir
              participer à cet examen.
            </p>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <IconSearch className="mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">
              Aucun résultat pour &quot;{searchQuery}&quot;
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredCandidates.map((candidate, index) => (
                <CandidateRow
                  key={candidate.user._id}
                  candidate={candidate}
                  index={index}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

interface CandidateRowProps {
  candidate: {
    user: {
      _id: string
      name: string | undefined
      email: string | undefined
      image: string | undefined
      username: string | undefined
    }
    expiresAt: number
    daysRemaining: number
  }
  index: number
}

function CandidateRow({ candidate, index }: CandidateRowProps) {
  const { user, expiresAt, daysRemaining } = candidate

  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"

  const isExpiringSoon = daysRemaining <= 7
  const isExpiringVerySoon = daysRemaining <= 3

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
        <AvatarImage src={user.image} alt={user.name || "User"} />
        <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-500 text-sm font-semibold text-white">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-gray-900 dark:text-white">
          {user.name || "Utilisateur"}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
          <IconMail className="h-3.5 w-3.5" />
          <span className="truncate">{user.email || user.username || "-"}</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {isExpiringSoon ? (
          <Badge
            variant="outline"
            className={cn(
              "font-medium",
              isExpiringVerySoon
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400"
                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
            )}
          >
            <IconClock className="mr-1 h-3 w-3" />
            {daysRemaining}j restants
          </Badge>
        ) : (
          <span className="text-xs text-gray-400">
            Expire le {format(new Date(expiresAt), "d MMM yyyy", { locale: fr })}
          </span>
        )}
      </div>
    </motion.div>
  )
}
