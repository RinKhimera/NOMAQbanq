import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

/**
 * Ferme automatiquement les participations in_progress des examens expirés
 * S'exécute toutes les heures
 */
crons.hourly(
  "close-expired-exam-participations",
  { minuteUTC: 0 }, // S'exécute à chaque heure pile (00:00, 01:00, etc.)
  internal.exams.closeExpiredParticipations,
)

/**
 * Ferme automatiquement les sessions d'entraînement expirées (24h TTL)
 * S'exécute toutes les heures, décalé de 30min par rapport aux examens
 */
crons.hourly(
  "close-expired-training-sessions",
  { minuteUTC: 30 }, // S'exécute à chaque heure +30 (00:30, 01:30, etc.)
  internal.training.closeExpiredTrainingSessions,
)

export default crons
