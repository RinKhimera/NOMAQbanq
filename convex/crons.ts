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

export default crons
