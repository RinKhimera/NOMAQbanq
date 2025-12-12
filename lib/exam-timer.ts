/**
 * Exam Timer Utilities
 *
 * Pure functions for exam timer calculations extracted from the assessment page.
 * These functions are deterministic and testable.
 */

/**
 * Calculate the remaining time for an exam session
 * @param serverStartTime - Server timestamp when the exam started (milliseconds)
 * @param completionTimeSeconds - Total allowed time in seconds
 * @param currentTime - Current timestamp (defaults to Date.now() for production, injectable for tests)
 * @returns Remaining time in milliseconds (minimum 0)
 */
export const calculateTimeRemaining = (
  serverStartTime: number,
  completionTimeSeconds: number,
  currentTime: number = Date.now(),
): number => {
  const elapsedTime = currentTime - serverStartTime
  const totalTimeMs = completionTimeSeconds * 1000
  return Math.max(0, totalTimeMs - elapsedTime)
}

/**
 * Check if the exam time has expired and auto-submit should be triggered
 * @param timeRemaining - Remaining time in milliseconds
 * @returns true if time is up
 */
export const shouldAutoSubmit = (timeRemaining: number): boolean => {
  return timeRemaining <= 0
}

/**
 * Format milliseconds to HH:MM:SS display format
 * @param ms - Time in milliseconds
 * @returns Formatted string "HH:MM:SS"
 */
export const formatExamTime = (ms: number): string => {
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((ms % (1000 * 60)) / 1000)
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

/**
 * Check if the elapsed time is within the allowed grace period
 * Grace period allows for network latency during submission:
 * - 30 seconds for auto-submit (time expired)
 * - 5 seconds for manual submit
 *
 * @param timeElapsed - Time elapsed since exam start (milliseconds)
 * @param maxTimeMs - Maximum allowed time (milliseconds)
 * @param isAutoSubmit - Whether this is an automatic submission
 * @returns true if within grace period, false if time exceeded
 */
export const isWithinGracePeriod = (
  timeElapsed: number,
  maxTimeMs: number,
  isAutoSubmit: boolean = false,
): boolean => {
  const gracePeriod = isAutoSubmit ? 30000 : 5000 // 30s for auto, 5s for manual
  const maxTimeWithGrace = maxTimeMs + gracePeriod
  return timeElapsed <= maxTimeWithGrace
}

/**
 * Check if the remaining time is in warning zone (less than 10 minutes)
 * @param timeRemaining - Remaining time in milliseconds
 * @returns true if less than 10 minutes remaining
 */
export const isTimeRunningOut = (timeRemaining: number): boolean => {
  return timeRemaining < 10 * 60 * 1000 // 10 minutes
}

/**
 * Check if the remaining time is in critical zone (less than 5 minutes)
 * @param timeRemaining - Remaining time in milliseconds
 * @returns true if less than 5 minutes remaining
 */
export const isTimeCritical = (timeRemaining: number): boolean => {
  return timeRemaining < 5 * 60 * 1000 // 5 minutes
}

/**
 * Calculate exam progress percentage based on questions answered
 * @param currentIndex - Current question index (0-based)
 * @param totalQuestions - Total number of questions
 * @returns Progress percentage (0-100)
 */
export const calculateProgress = (
  currentIndex: number,
  totalQuestions: number,
): number => {
  if (totalQuestions === 0) return 0
  return ((currentIndex + 1) / totalQuestions) * 100
}

/**
 * Calculate exam score based on answers
 * @param correctCount - Number of correct answers
 * @param totalQuestions - Total number of questions
 * @returns Score percentage (0-100), rounded to nearest integer
 */
export const calculateScorePercentage = (
  correctCount: number,
  totalQuestions: number,
): number => {
  if (totalQuestions === 0) return 0
  return Math.round((correctCount / totalQuestions) * 100)
}

// ==========================================
// PAUSE FUNCTIONALITY UTILITIES
// ==========================================

/**
 * Pause phase type for type safety
 */
export type PausePhase = "before_pause" | "during_pause" | "after_pause"

/**
 * Determine if the exam should trigger the pause based on elapsed time
 * The pause triggers when the timer reaches 50% (halfway point)
 * @param serverStartTime - Server timestamp when exam started (ms)
 * @param completionTimeSeconds - Total allowed time in seconds
 * @param currentTime - Current timestamp (defaults to Date.now())
 * @returns true if pause should be triggered
 */
export const shouldTriggerPause = (
  serverStartTime: number,
  completionTimeSeconds: number,
  currentTime: number = Date.now(),
): boolean => {
  const elapsedTime = currentTime - serverStartTime
  const totalTimeMs = completionTimeSeconds * 1000
  const halfTime = totalTimeMs / 2

  // Trigger pause when elapsed time reaches or exceeds 50%
  return elapsedTime >= halfTime
}

/**
 * Calculate the remaining time for the pause countdown
 * @param pauseStartedAt - Timestamp when pause began (ms)
 * @param pauseDurationMinutes - Duration of pause in minutes
 * @param currentTime - Current timestamp (defaults to Date.now())
 * @returns Remaining pause time in milliseconds (minimum 0)
 */
export const calculatePauseTimeRemaining = (
  pauseStartedAt: number,
  pauseDurationMinutes: number,
  currentTime: number = Date.now(),
): number => {
  const pauseDurationMs = pauseDurationMinutes * 60 * 1000
  const elapsedPauseTime = currentTime - pauseStartedAt
  return Math.max(0, pauseDurationMs - elapsedPauseTime)
}

/**
 * Check if the pause timer has expired
 * @param pauseStartedAt - Timestamp when pause began (ms)
 * @param pauseDurationMinutes - Duration of pause in minutes
 * @param currentTime - Current timestamp (defaults to Date.now())
 * @returns true if pause time has expired
 */
export const isPauseExpired = (
  pauseStartedAt: number,
  pauseDurationMinutes: number,
  currentTime: number = Date.now(),
): boolean => {
  return (
    calculatePauseTimeRemaining(
      pauseStartedAt,
      pauseDurationMinutes,
      currentTime,
    ) <= 0
  )
}

/**
 * Check if a question is accessible based on the current pause phase
 * @param questionIndex - 0-based index of the question
 * @param totalQuestions - Total number of questions in the exam
 * @param pausePhase - Current pause phase
 * @returns Object with `allowed` boolean and optional `reason` string
 */
export const isQuestionAccessible = (
  questionIndex: number,
  totalQuestions: number,
  pausePhase: PausePhase | undefined,
): { allowed: boolean; reason?: string } => {
  // If no pause phase is set, all questions are accessible
  if (!pausePhase) {
    return { allowed: true }
  }

  const midpoint = Math.floor(totalQuestions / 2)

  switch (pausePhase) {
    case "before_pause":
      // Can only access first half (0 to midpoint-1)
      if (questionIndex >= midpoint) {
        return {
          allowed: false,
          reason: `Question ${questionIndex + 1} sera déverrouillée après la pause`,
        }
      }
      return { allowed: true }

    case "during_pause":
      // All questions are locked during pause
      return {
        allowed: false,
        reason: "Questions verrouillées pendant la pause",
      }

    case "after_pause":
      // All questions are accessible after pause
      return { allowed: true }

    default:
      return { allowed: true }
  }
}

/**
 * Get the range of accessible question indices based on pause phase
 * @param totalQuestions - Total number of questions
 * @param pausePhase - Current pause phase
 * @returns Object with `start` and `end` indices (inclusive)
 */
export const getAccessibleQuestionRange = (
  totalQuestions: number,
  pausePhase: PausePhase | undefined,
): { start: number; end: number } => {
  const midpoint = Math.floor(totalQuestions / 2)

  if (!pausePhase || pausePhase === "after_pause") {
    return { start: 0, end: totalQuestions - 1 }
  }

  if (pausePhase === "before_pause") {
    return { start: 0, end: midpoint - 1 }
  }

  // during_pause - no questions accessible
  return { start: -1, end: -1 }
}

/**
 * Format pause time remaining to MM:SS display format
 * @param ms - Time in milliseconds
 * @returns Formatted string "MM:SS"
 */
export const formatPauseTime = (ms: number): string => {
  const minutes = Math.floor(ms / (1000 * 60))
  const seconds = Math.floor((ms % (1000 * 60)) / 1000)
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

/**
 * Calculate how many questions remain until the pause
 * @param currentQuestionIndex - Current 0-based question index
 * @param totalQuestions - Total number of questions
 * @returns Number of questions until pause (0 if already at or past midpoint)
 */
export const questionsUntilPause = (
  currentQuestionIndex: number,
  totalQuestions: number,
): number => {
  const midpoint = Math.floor(totalQuestions / 2)
  return Math.max(0, midpoint - currentQuestionIndex - 1)
}

/**
 * Check if the exam is approaching pause (within 10 questions)
 * @param currentQuestionIndex - Current 0-based question index
 * @param totalQuestions - Total number of questions
 * @returns true if within 10 questions of the pause point
 */
export const isApproachingPause = (
  currentQuestionIndex: number,
  totalQuestions: number,
): boolean => {
  const remaining = questionsUntilPause(currentQuestionIndex, totalQuestions)
  return remaining > 0 && remaining <= 10
}
