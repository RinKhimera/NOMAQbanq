"use client"

import { useMutation } from "convex/react"
import { Layers, Loader2, Play, Target } from "lucide-react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useActionState, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"

interface TrainingConfigFormProps {
  domains: { domain: string; count: number }[]
  totalQuestions: number
}

const QUESTION_MARKS = [5, 10, 15, 20]

export const TrainingConfigForm = ({
  domains,
  totalQuestions,
}: TrainingConfigFormProps) => {
  const router = useRouter()
  const [questionCount, setQuestionCount] = useState(10)
  const [selectedDomain, setSelectedDomain] = useState<string>("all")

  const createSession = useMutation(api.training.createTrainingSession)

  const selectedDomainQuestions =
    selectedDomain === "all"
      ? totalQuestions
      : (domains.find((d) => d.domain === selectedDomain)?.count ?? 0)

  const maxQuestions = Math.min(20, selectedDomainQuestions)
  const isValidCount = questionCount <= selectedDomainQuestions

  const [, startTransition] = useTransition()
  const [, submitAction, isPending] = useActionState(async () => {
    if (!isValidCount) return null

    try {
      const result = await createSession({
        questionCount,
        domain: selectedDomain === "all" ? undefined : selectedDomain,
      })

      toast.success("Session créée !", {
        description: `${questionCount} questions sélectionnées`,
      })

      router.push(`/dashboard/entrainement/${result.sessionId}`)
    } catch (error) {
      toast.error("Erreur", {
        description:
          error instanceof Error ? error.message : "Une erreur est survenue",
      })
    }

    return null
  }, null)

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 shadow-lg backdrop-blur-sm dark:border-gray-700/60 dark:bg-gray-900/80">
      {/* Header with gradient */}
      <div className="border-b border-gray-200/60 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 px-6 py-4 dark:border-gray-700/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md">
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
              className="font-display flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-lg font-bold text-white shadow-md"
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
              className="[&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-emerald-500 [&_[data-slot=slider-range]]:to-teal-500 [&_[data-slot=slider-thumb]]:h-6 [&_[data-slot=slider-thumb]]:w-6 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-emerald-500 [&_[data-slot=slider-thumb]]:shadow-lg [&_[data-slot=slider-thumb]]:shadow-emerald-500/20 [&_[data-slot=slider-track]]:h-3 [&_[data-slot=slider-track]]:bg-gradient-to-r [&_[data-slot=slider-track]]:from-gray-100 [&_[data-slot=slider-track]]:to-gray-200 [&_[data-slot=slider-track]]:dark:from-gray-800 [&_[data-slot=slider-track]]:dark:to-gray-700"
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

          <Select value={selectedDomain} onValueChange={setSelectedDomain}>
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
              Seulement {selectedDomainQuestions} questions disponibles dans ce
              domaine. Réduisez le nombre ou changez de domaine.
            </motion.p>
          )}
        </div>

        {/* Submit button */}
        <Button
          onClick={() => startTransition(submitAction)}
          disabled={isPending || !isValidCount}
          size="lg"
          className="h-14 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-base font-semibold shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
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
