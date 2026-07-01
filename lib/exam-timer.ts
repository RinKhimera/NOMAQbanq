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

// ==========================================
// PAUSE FUNCTIONALITY UTILITIES
// ==========================================

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
 * Format pause time remaining to MM:SS display format
 * @param ms - Time in milliseconds
 * @returns Formatted string "MM:SS"
 */
export const formatPauseTime = (ms: number): string => {
  const minutes = Math.floor(ms / (1000 * 60))
  const seconds = Math.floor((ms % (1000 * 60)) / 1000)
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}
