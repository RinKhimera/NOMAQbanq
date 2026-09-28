"use client"

import { IconMail, IconSearch, IconUsers } from "@tabler/icons-react"
import { CircleAlert, Search } from "lucide-react"
import { motion } from "motion/react"
import { useMemo, useState } from "react"
import {
  AccessBadge,
  getAccessStatus,
} from "@/components/shared/payments/access-badge"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { EligibleCandidate } from "@/features/exams/dal"
import { formatMediumDate } from "@/lib/format"
import { cn } from "@/lib/utils"

export function EligibleCandidatesSection({
  candidates,
  embedded = false,
}: {
  candidates: EligibleCandidate[]
  /** Rendu sans le chrome `Card` (header teal) + hauteur souple, pour un montage
   *  dans un Dialog qui apporte déjà son propre titre. */
  embedded?: boolean
}) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidates

    const query = searchQuery.toLowerCase()
    return candidates.filter(
      (c) =>
        c.user.name?.toLowerCase().includes(query) ||
        c.user.email?.toLowerCase().includes(query) ||
        c.user.username?.toLowerCase().includes(query),
    )
  }, [candidates, searchQuery])

  const total = candidates.length

  const body = (
    <>
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
        <EmptyState
          size="compact"
          icons={[CircleAlert]}
          title="Aucun candidat éligible"
          description="Les utilisateurs doivent avoir un accès exam actif pour pouvoir participer à cet examen."
        />
      ) : filteredCandidates.length === 0 ? (
        <EmptyState
          size="compact"
          icons={[Search]}
          title={`Aucun résultat pour "${searchQuery}"`}
        />
      ) : (
        <ScrollArea className={cn(embedded ? "h-[min(60vh,420px)]" : "h-100")}>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredCandidates.map((candidate, index) => (
              <CandidateRow
                key={candidate.user.id}
                candidate={candidate}
                index={index}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </>
  )

  if (embedded) {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
        {body}
      </div>
    )
  }

  return (
    <Card className="overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-none">
      <CardHeader className="border-b bg-linear-to-r from-teal-500 to-cyan-500 text-white">
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
      <CardContent className="p-0">{body}</CardContent>
    </Card>
  )
}

interface CandidateRowProps {
  candidate: EligibleCandidate
  index: number
}

function CandidateRow({ candidate, index }: CandidateRowProps) {
  const { user, expiresAt, daysRemaining } = candidate

  const status = getAccessStatus(expiresAt, daysRemaining)

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className={cn(
        "flex items-center gap-4 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50",
      )}
    >
      <UserAvatar
        name={user.name}
        image={user.image}
        className="h-12 w-12 border-2 border-teal-100 shadow-sm dark:border-teal-800"
        fallbackClassName="bg-linear-to-br from-teal-500 to-cyan-500 text-sm font-semibold text-white"
      />

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
        {status === "expiring" ? (
          <AccessBadge
            accessType="exam"
            status={status}
            daysRemaining={daysRemaining}
            size="sm"
          />
        ) : (
          <span className="text-xs text-gray-400">
            Expire le {formatMediumDate(expiresAt)}
          </span>
        )}
      </div>
    </motion.div>
  )
}
