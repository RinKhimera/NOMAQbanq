"use client"

import { IconTargetArrow } from "@tabler/icons-react"
import { BookOpen, GraduationCap, Layers, Play, Target } from "lucide-react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import {
  createTrainingSession,
  loadAvailableObjectifsCMC,
  loadRevisionCounts,
} from "@/features/training/actions"
import {
  REVISION_CRITERIA,
  REVISION_CRITERION_LABELS,
  type RevisionCriterion,
} from "@/features/training/schemas"
import { callAction } from "@/lib/safe-action"
import { cn } from "@/lib/utils"
import { ObjectifsCMCMultiSelect } from "./objectifs-cmc-multi-select"

interface TrainingConfigFormProps {
  domains: { domain: string; count: number }[]
  totalQuestions: number
  objectifs: Array<{ objectif: string; count: number }>
}

const QUESTION_MARKS = [5, 10, 15, 20]

export const TrainingConfigForm = ({
  domains,
  totalQuestions,
  objectifs,
}: TrainingConfigFormProps) => {
  const router = useRouter()
  const [questionCount, setQuestionCount] = useState(10)
  const [selectedDomain, setSelectedDomain] = useState<string>("all")
  const [selectedObjectifs, setSelectedObjectifs] = useState<string[]>([])
  const [trainingMode, setTrainingMode] = useState<"tutor" | "test">("test")
  const [revisionFilters, setRevisionFilters] = useState<RevisionCriterion[]>(
    [],
  )
  const [revisionCounts, setRevisionCounts] = useState<
    Record<RevisionCriterion, number>
  >({ failed: 0, unseen: 0, bookmarked: 0 })
  const [isCountsLoading, startCountsLoad] = useTransition()

  // Objectifs filtrés par domaine via Server Action (remplace useQuery réactif).
  // Initialisés avec la prop (tous domaines = état initial). setState seulement
  // dans le callback de transition → pas de set-state-in-effect synchrone.
  const [filteredObjectifs, setFilteredObjectifs] = useState<{
    objectifs: { objectif: string; count: number }[]
  }>({ objectifs })
  const [isObjLoading, startObjLoad] = useTransition()

  useEffect(() => {
    startObjLoad(async () => {
      try {
        const res = await loadAvailableObjectifsCMC(
          selectedDomain === "all" ? undefined : selectedDomain,
        )
        setFilteredObjectifs(res)
      } catch {
        // rejet réseau : la liste affichée reste celle de l'ANCIEN domaine —
        // signaler, sinon l'UX ment sans aucun indice
        toast.error(
          "Impossible de charger les objectifs du domaine. Vérifiez votre réseau.",
        )
      }
    })
  }, [selectedDomain])

  // Clé stable : `selectedObjectifs` change d'identité à chaque `setState`, et
  // chaque exécution coûte un balayage complet de la banque de questions.
  // Sérialisation JSON et non `join("|")` : un objectif CMC est un champ libre
  // côté admin, un `|` dedans découperait la liste au mauvais endroit.
  const objectifsKey = JSON.stringify(selectedObjectifs)

  useEffect(() => {
    startCountsLoad(async () => {
      try {
        const objectifsCMCs = JSON.parse(objectifsKey) as string[]
        const counts = await loadRevisionCounts({
          domain: selectedDomain === "all" ? undefined : selectedDomain,
          objectifsCMCs: objectifsCMCs.length > 0 ? objectifsCMCs : undefined,
        })
        setRevisionCounts(counts)
      } catch {
        // Sans ça, les puces resteraient à 0 en silence — l'étudiant croirait
        // n'avoir aucun historique.
        toast.error(
          "Impossible de charger vos compteurs de révision. Vérifiez votre réseau.",
        )
      }
    })
  }, [selectedDomain, objectifsKey])

  const toggleRevisionFilter = (criterion: RevisionCriterion) =>
    setRevisionFilters((current) =>
      current.includes(criterion)
        ? current.filter((c) => c !== criterion)
        : [...current, criterion],
    )

  const selectedDomainQuestions =
    selectedDomain === "all"
      ? totalQuestions
      : (domains.find((d) => d.domain === selectedDomain)?.count ?? 0)

  // Si objectifs sélectionnés, compter les questions filtrées
  let availableQuestions = selectedDomainQuestions
  if (selectedObjectifs.length > 0 && filteredObjectifs) {
    availableQuestions = filteredObjectifs.objectifs
      .filter((obj) => selectedObjectifs.includes(obj.objectif))
      .reduce((sum, obj) => sum + obj.count, 0)
  }

  const maxQuestions = Math.min(20, availableQuestions)
  const isValidCount = questionCount <= availableQuestions

  const handleDomainChange = (domain: string) => {
    setSelectedDomain(domain)
    setSelectedObjectifs([])
  }

  const [, startTransition] = useTransition()
  const [, submitAction, isPending] = useActionState(async () => {
    if (!isValidCount) return null

    // `callAction` ne throw jamais : un rejet réseau devient `success: false` au
    // lieu de contourner le garde ci-dessous.
    const result = await callAction(() =>
      createTrainingSession({
        questionCount,
        domain: selectedDomain === "all" ? undefined : selectedDomain,
        objectifsCMCs:
          selectedObjectifs.length > 0 ? selectedObjectifs : undefined,
        mode: trainingMode,
        revisionFilters:
          revisionFilters.length > 0 ? revisionFilters : undefined,
      }),
    )

    if (!result.success) {
      toast.error("Erreur", { description: result.error })
      return null
    }

    // Le nombre annoncé est celui RETENU par le serveur : en révision, le corpus
    // peut être plus court que la demande.
    toast.success("Session créée !", {
      description: `${result.questionCount} questions sélectionnées`,
    })

    router.push(`/tableau-de-bord/entrainement/${result.sessionId}`)

    return null
  }, null)

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 shadow-lg backdrop-blur-sm dark:border-gray-700/60 dark:bg-gray-900/80">
      {/* Header with gradient */}
      <div className="border-b border-gray-200/60 bg-linear-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 px-6 py-4 dark:border-gray-700/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 shadow-md">
            <Target className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-white">
              Nouvelle session
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Configurez votre entraînement
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8 p-6">
        {/* Question count slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Nombre de questions
            </label>
            <motion.div
              key={questionCount}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-display flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 text-lg font-bold text-white shadow-md"
            >
              {questionCount}
            </motion.div>
          </div>

          {/* Custom slider track with marks */}
          <div className="relative pt-2 pb-6">
            <Slider
              value={[questionCount]}
              onValueChange={([value]) => setQuestionCount(value)}
              min={5}
              max={maxQuestions}
              step={1}
              className="**:data-[slot=slider-range]:bg-linear-to-r **:data-[slot=slider-range]:from-emerald-500 **:data-[slot=slider-range]:to-teal-500 **:data-[slot=slider-thumb]:h-6 **:data-[slot=slider-thumb]:w-6 **:data-[slot=slider-thumb]:border-2 **:data-[slot=slider-thumb]:border-emerald-500 **:data-[slot=slider-thumb]:shadow-lg **:data-[slot=slider-thumb]:shadow-emerald-500/20 **:data-[slot=slider-track]:h-3 **:data-[slot=slider-track]:bg-linear-to-r **:data-[slot=slider-track]:from-gray-100 **:data-[slot=slider-track]:to-gray-200 **:data-[slot=slider-track]:dark:from-gray-800 **:data-[slot=slider-track]:dark:to-gray-700"
            />

            {/* Marks */}
            <div className="absolute inset-x-0 bottom-0 flex justify-between px-1">
              {QUESTION_MARKS.filter((m) => m <= maxQuestions).map((mark) => (
                <button
                  key={mark}
                  type="button"
                  onClick={() => setQuestionCount(mark)}
                  className={cn(
                    "flex h-6 w-8 items-center justify-center rounded-md text-xs font-medium transition-all",
                    questionCount === mark
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300",
                  )}
                >
                  {mark}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Domain selector */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-gray-500" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Domaine
            </label>
          </div>

          <Select value={selectedDomain} onValueChange={handleDomainChange}>
            <SelectTrigger className="h-12 rounded-xl border-gray-200 bg-white/60 text-base shadow-sm transition-all hover:border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-800/60 dark:hover:border-emerald-700">
              <SelectValue placeholder="Sélectionnez un domaine" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="rounded-lg">
                <div className="flex items-center gap-2">
                  <span>Tous les domaines</span>
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {totalQuestions}
                  </span>
                </div>
              </SelectItem>
              {domains.map((domain) => (
                <SelectItem
                  key={domain.domain}
                  value={domain.domain}
                  className="rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span>{domain.domain}</span>
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {domain.count}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Warning if not enough questions */}
          {!isValidCount && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-amber-600 dark:text-amber-400"
            >
              Seulement {availableQuestions} question
              {availableQuestions > 1 ? "s" : ""} disponible
              {availableQuestions > 1 ? "s" : ""} avec ces filtres. Réduisez le
              nombre ou modifiez les filtres.
            </motion.p>
          )}
        </div>

        {/* Objectifs CMC multi-selector */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <IconTargetArrow className="h-4 w-4 text-gray-500" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Objectifs CMC (optionnel)
            </label>
          </div>

          <ObjectifsCMCMultiSelect
            objectifs={filteredObjectifs.objectifs}
            selectedObjectifs={selectedObjectifs}
            onChange={setSelectedObjectifs}
            isLoading={isObjLoading}
            maxSelections={10}
          />

          {/* Info dynamique sur les questions disponibles */}
          {selectedObjectifs.length > 0 && filteredObjectifs && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-emerald-600 dark:text-emerald-400"
            >
              {availableQuestions} question{availableQuestions > 1 ? "s" : ""}{" "}
              disponible{availableQuestions > 1 ? "s" : ""} pour ces objectifs
            </motion.p>
          )}
        </div>

        {/* Filtres de révision */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-gray-500" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Réviser (optionnel)
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {REVISION_CRITERIA.map((criterion) => {
              const isActive = revisionFilters.includes(criterion)
              return (
                <button
                  key={criterion}
                  type="button"
                  data-testid={`revision-${criterion}`}
                  aria-pressed={isActive}
                  onClick={() => toggleRevisionFilter(criterion)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                    isActive
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300"
                      : "border-gray-200 bg-white/60 text-gray-700 hover:border-emerald-300 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300",
                  )}
                >
                  <span>{REVISION_CRITERION_LABELS[criterion]}</span>
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {isCountsLoading ? "…" : revisionCounts[criterion]}
                  </span>
                </button>
              )
            })}
          </div>

          {revisionFilters.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {/* Phrase en littéral : en texte JSX, la coupure de ligne après
                  l'interpolation supprime l'espace au rendu Turbopack (« 20questions »),
                  et Prettier réécrit le {" "} qui la corrigerait. */}
              {`La session prendra jusqu'à ${questionCount} questions parmi celles qui correspondent — moins s'il y en a moins.`}
            </p>
          )}
        </div>

        {/* Mode d'entraînement */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-gray-500" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Mode d&apos;entraînement
            </label>
          </div>

          <RadioGroup
            value={trainingMode}
            onValueChange={(v) => setTrainingMode(v as "tutor" | "test")}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {/* Mode test */}
            <Label
              htmlFor="mode-test"
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all",
                trainingMode === "test"
                  ? "border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20"
                  : "border-gray-200 bg-white/60 hover:border-emerald-300 dark:border-gray-700 dark:bg-gray-800/60 dark:hover:border-emerald-700",
              )}
            >
              <RadioGroupItem
                id="mode-test"
                value="test"
                className="mt-0.5 shrink-0 border-emerald-500 text-emerald-600"
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Mode test
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Correction seulement à la fin de la session
                </p>
              </div>
            </Label>

            {/* Mode tuteur */}
            <Label
              htmlFor="mode-tutor"
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all",
                trainingMode === "tutor"
                  ? "border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20"
                  : "border-gray-200 bg-white/60 hover:border-emerald-300 dark:border-gray-700 dark:bg-gray-800/60 dark:hover:border-emerald-700",
              )}
            >
              <RadioGroupItem
                id="mode-tutor"
                value="tutor"
                className="mt-0.5 shrink-0 border-emerald-500 text-emerald-600"
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Mode tuteur
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Correction et explication révélées après chaque réponse
                </p>
              </div>
            </Label>
          </RadioGroup>
        </div>

        {/* Submit button */}
        <Button
          onClick={() => startTransition(submitAction)}
          disabled={isPending || !isValidCount}
          size="lg"
          className="h-14 w-full rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 text-base font-semibold shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Spinner className="mr-2" />
              Création en cours...
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              Commencer l&apos;entraînement
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
