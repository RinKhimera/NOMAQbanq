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
