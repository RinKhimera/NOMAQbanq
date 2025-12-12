"use client"

import { CheckCircle, Coffee, Lock } from "lucide-react"
import { motion } from "motion/react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PauseApproachingAlertProps {
  questionsRemaining: number
  questionsAnswered: number
  midpoint: number
  totalQuestions: number
  canTakeEarlyPause: boolean
  onTakeEarlyPause: () => void
  className?: string
}

export const PauseApproachingAlert = ({
  questionsRemaining,
  questionsAnswered,
  midpoint,
  totalQuestions,
  canTakeEarlyPause,
  onTakeEarlyPause,
  className,
}: PauseApproachingAlertProps) => {
  if (questionsRemaining > 10) {
    return null
  }

  const isImminent = questionsRemaining <= 3 && questionsRemaining > 0
  const allAnswered = questionsRemaining === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <Alert
        className={cn(
          "border-2",
          allAnswered
            ? "border-green-400 bg-green-50 dark:border-green-600 dark:bg-green-900/30"
            : isImminent
              ? "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/30"
              : "border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30",
        )}
      >
        {allAnswered ? (
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
        ) : (
          <Coffee
            className={cn(
              "h-5 w-5",
              isImminent ? "text-amber-600" : "text-blue-600",
            )}
          />
        )}
        <AlertTitle
          className={cn(
            allAnswered
              ? "text-green-900 dark:text-green-100"
              : isImminent
                ? "text-amber-900 dark:text-amber-100"
                : "text-blue-900 dark:text-blue-100",
          )}
        >
          {allAnswered
            ? "✅ Première vague complétée !"
            : isImminent
              ? "⚠️ Pause imminente"
              : "☕ Pause obligatoire à venir"}
        </AlertTitle>
        <AlertDescription
          className={cn(
            allAnswered
              ? "text-green-800 dark:text-green-200"
              : isImminent
                ? "text-amber-800 dark:text-amber-200"
                : "text-blue-800 dark:text-blue-200",
          )}
        >
          {allAnswered ? (
            <>
              <p className="font-medium">
                Vous avez répondu aux {midpoint} premières questions !
              </p>
              <p className="mt-2 text-sm">
                Vous pouvez maintenant prendre votre pause ou continuer à
                réviser vos réponses. La pause se déclenchera automatiquement à
                50% du temps écoulé.
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm">
                <Lock className="h-3.5 w-3.5" />
                Questions {midpoint + 1} à {totalQuestions} seront
                déverrouillées après la pause.
              </p>
              {canTakeEarlyPause && (
                <Button
                  onClick={onTakeEarlyPause}
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full border-green-300 bg-green-100 text-green-700 hover:bg-green-200 hover:text-green-800 dark:border-green-700 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900/70"
                >
                  <Coffee className="mr-2 h-4 w-4" />
                  Prendre la pause maintenant
                </Button>
              )}
            </>
          ) : (
            <>
              <p>
                {questionsRemaining === 1
                  ? "Répondez à 1 dernière question pour débloquer la possibilité de pause."
                  : `Répondez à ${questionsRemaining} questions supplémentaires pour débloquer la possibilité de pause.`}
              </p>
              <p className="mt-1 text-sm">
                {questionsAnswered}/{midpoint} questions répondues dans la
                première vague
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm">
                <Lock className="h-3.5 w-3.5" />
                Questions {midpoint + 1} à {totalQuestions} seront
                déverrouillées après la pause.
              </p>
            </>
          )}
        </AlertDescription>
      </Alert>
    </motion.div>
  )
}

export default PauseApproachingAlert
