"use client"

import { IconUsers } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { EligibleCandidate } from "@/features/exams/dal"
import { EligibleCandidatesSection } from "../[id]/_components/eligible-candidates-section"

interface AudienceEligibilityProps {
  /** Pool d'abonnés avec accès examen actif (déjà chargé par la page, capé à 100). */
  candidates: EligibleCandidate[]
  audienceType: "subscribers" | "restricted"
  /** Nombre d'utilisateurs choisis (mode restreint) — `selectedUsers.length`. */
  selectedCount: number
}

/**
 * Résumé contextuel de l'audience d'un examen, monté dans la carte « À qui
 * s'adresse cet examen ? » du formulaire create/edit :
 *  - `subscribers` : compte d'abonnés éligibles + Dialog « Voir la liste » (recherche) ;
 *  - `restricted` : compte d'utilisateurs sélectionnés (le picker fait office de liste).
 *
 * Le compte est capé à 100 (cf. `getEligibleExamCandidates`) → affiché « 100+ »
 * quand le plafond est atteint.
 */
export function AudienceEligibility({
  candidates,
  audienceType,
  selectedCount,
}: Readonly<AudienceEligibilityProps>) {
  if (audienceType === "restricted") {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-sm dark:border-gray-700 dark:bg-gray-900/40">
        <p className="font-medium text-gray-900 dark:text-white">
          {selectedCount === 0
            ? "Aucun utilisateur sélectionné"
            : `${selectedCount} utilisateur${selectedCount > 1 ? "s" : ""} sélectionné${selectedCount > 1 ? "s" : ""}`}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          L&apos;accès est octroyé aux utilisateurs sélectionnés, même sans
          abonnement.
        </p>
      </div>
    )
  }

  // subscribers
  const total = candidates.length
  const isCapped = total >= 100
  const countLabel = isCapped ? "100+" : String(total)

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="flex items-center gap-2 text-sm">
        <IconUsers className="h-4 w-4 text-teal-600 dark:text-teal-400" />
        {total === 0 ? (
          <span className="text-gray-500">Aucun candidat éligible</span>
        ) : (
          <span className="text-gray-900 dark:text-white">
            <span className="font-semibold">{countLabel}</span> candidat
            {total > 1 ? "s" : ""} éligible{total > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {total > 0 && (
        <Dialog>
          <DialogTrigger asChild>
            {/* type=button : ce bloc vit dans un <form>, éviter une soumission. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              Voir la liste
            </Button>
          </DialogTrigger>
          <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
            <DialogHeader className="p-4 pb-2">
              <DialogTitle>Candidats éligibles ({countLabel})</DialogTitle>
            </DialogHeader>
            {isCapped && (
              <p className="px-4 pb-2 text-xs text-amber-600 dark:text-amber-400">
                100 premiers affichés — recherchez pour affiner.
              </p>
            )}
            <EligibleCandidatesSection candidates={candidates} embedded />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
