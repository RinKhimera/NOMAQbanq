"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"
import { IconUsers, IconAlertCircle, IconChevronRight } from "@tabler/icons-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useState } from "react"

interface EligibleCandidatesCardProps {
  /** Nombre maximum de candidats à afficher initialement */
  initialLimit?: number
  /** Mode compact (moins d'espace, pas de description) */
  compact?: boolean
  /** Classe CSS additionnelle */
  className?: string
}

export function EligibleCandidatesCard({
  initialLimit = 5,
  compact = false,
  className,
}: EligibleCandidatesCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const eligibleCandidates = useQuery(
    api.users.getUsersWithActiveExamAccess,
    { limit: 50 },
  )

  const isLoading = eligibleCandidates === undefined

  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader className={cn(compact ? "pb-2" : "")}>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const total = eligibleCandidates.length
  const displayedCandidates = isExpanded
    ? eligibleCandidates
    : eligibleCandidates.slice(0, initialLimit)
  const hasMore = total > initialLimit

  return (
    <Card
      className={cn(
        "overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-none",
        className,
      )}
    >
      <CardHeader
        className={cn(
          "border-b bg-gradient-to-r from-teal-500 to-cyan-500 text-white",
          compact && "py-3",
        )}
      >
        <div className="flex items-center gap-2">
          <IconUsers className="h-5 w-5" />
          <CardTitle className={cn(compact ? "text-base" : "text-lg")}>
            Candidats éligibles
          </CardTitle>
          <Badge
            variant="secondary"
            className="ml-auto bg-white/20 text-white hover:bg-white/30"
          >
            {total}
          </Badge>
        </div>
        {!compact && (
          <CardDescription className="text-teal-100">
            Utilisateurs avec un accès exam actif
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className={cn("p-4", compact && "p-3")}>
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-gray-500">
            <IconAlertCircle className="mb-2 h-10 w-10 text-gray-400" />
            <p className="text-sm font-medium">Aucun candidat éligible</p>
            <p className="mt-1 text-xs">
              Les utilisateurs doivent avoir un accès exam actif
            </p>
          </div>
        ) : (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <div className="space-y-2">
              {displayedCandidates.map((candidate) => (
                <CandidateRow
                  key={candidate.user._id}
                  candidate={candidate}
                  compact={compact}
                />
              ))}
            </div>

            {hasMore && (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 w-full text-teal-600 hover:bg-teal-50 hover:text-teal-700 dark:text-teal-400 dark:hover:bg-teal-900/20"
                >
                  {isExpanded ? (
                    "Réduire"
                  ) : (
                    <>
                      Voir tous les candidats ({total})
                      <IconChevronRight className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            )}

            <CollapsibleContent>
              {/* Extra candidates rendered when expanded */}
            </CollapsibleContent>
          </Collapsible>
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
  compact?: boolean
}

function CandidateRow({ candidate, compact }: CandidateRowProps) {
  const { user, daysRemaining } = candidate
  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"

  const isExpiringSoon = daysRemaining <= 7

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50",
        compact && "p-1.5",
      )}
    >
      <Avatar className={cn("h-8 w-8", compact && "h-7 w-7")}>
        <AvatarImage src={user.image} alt={user.name || "User"} />
        <AvatarFallback className="bg-teal-100 text-xs text-teal-700 dark:bg-teal-900 dark:text-teal-300">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-medium text-gray-900 dark:text-white",
            compact ? "text-sm" : "text-sm",
          )}
        >
          {user.name || "Utilisateur"}
        </p>
        {!compact && (
          <p className="truncate text-xs text-gray-500">
            {user.email || user.username || "-"}
          </p>
        )}
      </div>

      {isExpiringSoon && (
        <Badge
          variant="outline"
          className="shrink-0 border-amber-200 bg-amber-50 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
        >
          {daysRemaining}j
        </Badge>
      )}
    </div>
  )
}
