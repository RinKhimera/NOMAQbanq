import "server-only"
import { cleanupQuizRateLimits } from "@/lib/quiz-rate-limit"
import { closeExpiredExamParticipations } from "../exams/cron"
import { sendPendingNotifications } from "../notifications/cron"
import { auditProductPriceDrift } from "../payments/cron"
import { closeExpiredTrainingSessions } from "../training/cron"
import { anonymizeExpiredDeletedAccounts } from "../users/cron"
import type { CronTask } from "./run"

/**
 * Les tâches du cron, dans l'ordre d'exécution. Ajouter une tâche = ajouter
 * une entrée ; chaque contrainte d'ordre est un commentaire à côté de
 * l'entrée qu'elle contraint. Les `key` sont les clés du rapport JSON.
 */
export const SCHEDULE: readonly CronTask[] = [
  {
    key: "examParticipations",
    label: "clôture examens",
    tag: "[cron:exams]",
    run: closeExpiredExamParticipations,
  },
  {
    key: "trainingSessions",
    label: "clôture entraînements",
    tag: "[cron:trainings]",
    run: closeExpiredTrainingSessions,
  },
  {
    key: "anonymizedAccounts",
    label: "anonymisation",
    tag: "[cron:anonymize]",
    run: anonymizeExpiredDeletedAccounts,
  },
  {
    key: "quizRateLimitCleanup",
    label: "purge rate-limit quiz",
    tag: "[cron:quiz-rl]",
    run: cleanupQuizRateLimits,
  },
  // APRÈS les clôtures : les `auto_submitted` du même passage sont notifiés.
  {
    key: "notifications",
    label: "notifications",
    tag: "[cron:notifications]",
    run: sendPendingNotifications,
  },
  // EN DERNIER : seule tâche purement informative, et seule à faire un
  // aller-retour hors Neon. L'appelant coupe à `--max-time 60` — ce qui peut
  // être perdu ici est un rapport de dérive, pas une clôture ni un courriel.
  {
    key: "priceDrift",
    label: "dérive des prix catalogue",
    tag: "[cron:price-drift]",
    run: auditProductPriceDrift,
  },
]
