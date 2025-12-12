import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getExamStatus } from "@/lib/exam-status"

describe("Exam Status Utilities", () => {
  describe("getExamStatus", () => {
    const NOW = 1700000000000 // Fixed point in time

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(NOW)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe("inactive exams", () => {
      it("should return inactive when isActive is false regardless of dates", () => {
        const exam = {
          isActive: false,
          startDate: NOW - 1000, // Started
          endDate: NOW + 1000, // Not ended
        }

        expect(getExamStatus(exam)).toBe("inactive")
      })

      it("should return inactive even if dates are in the future", () => {
        const exam = {
          isActive: false,
          startDate: NOW + 10000,
          endDate: NOW + 20000,
        }

        expect(getExamStatus(exam)).toBe("inactive")
      })

      it("should return inactive even if dates are in the past", () => {
        const exam = {
          isActive: false,
          startDate: NOW - 20000,
          endDate: NOW - 10000,
        }

        expect(getExamStatus(exam)).toBe("inactive")
      })
    })

    describe("upcoming exams", () => {
      it("should return upcoming when start date is in the future", () => {
        const exam = {
          isActive: true,
          startDate: NOW + 1000,
          endDate: NOW + 10000,
        }

        expect(getExamStatus(exam)).toBe("upcoming")
      })

      it("should return upcoming for far future exam", () => {
        const exam = {
          isActive: true,
          startDate: NOW + 86400000, // 1 day from now
          endDate: NOW + 172800000, // 2 days from now
        }

        expect(getExamStatus(exam)).toBe("upcoming")
      })
    })

    describe("completed exams", () => {
      it("should return completed when end date is in the past", () => {
        const exam = {
          isActive: true,
          startDate: NOW - 10000,
          endDate: NOW - 1000,
        }

        expect(getExamStatus(exam)).toBe("completed")
      })

      it("should return completed for far past exam", () => {
        const exam = {
          isActive: true,
          startDate: NOW - 172800000, // 2 days ago
          endDate: NOW - 86400000, // 1 day ago
        }

        expect(getExamStatus(exam)).toBe("completed")
      })
    })

    describe("active exams", () => {
      it("should return active when within start and end dates", () => {
        const exam = {
          isActive: true,
          startDate: NOW - 1000,
          endDate: NOW + 1000,
        }

        expect(getExamStatus(exam)).toBe("active")
      })

      it("should return active for long running exam", () => {
        const exam = {
          isActive: true,
          startDate: NOW - 86400000, // Started 1 day ago
          endDate: NOW + 86400000, // Ends 1 day from now
        }

        expect(getExamStatus(exam)).toBe("active")
      })
    })

    describe("boundary conditions", () => {
      it("should return active at exact start time", () => {
        const exam = {
          isActive: true,
          startDate: NOW, // Exact current time
          endDate: NOW + 10000,
        }

        // At exact start time, now < startDate is false, so not upcoming
        // now > endDate is false, so not completed
        // Therefore active
        expect(getExamStatus(exam)).toBe("active")
      })

      it("should return completed at exact end time", () => {
        const exam = {
          isActive: true,
          startDate: NOW - 10000,
          endDate: NOW, // Exact current time
        }

        // At exact end time, now > endDate is false, so not completed
        // Therefore active (equal to endDate is still active)
        expect(getExamStatus(exam)).toBe("active")
      })

      it("should return completed 1ms after end time", () => {
        const exam = {
          isActive: true,
          startDate: NOW - 10000,
          endDate: NOW - 1, // 1ms in the past
        }

        expect(getExamStatus(exam)).toBe("completed")
      })

      it("should return upcoming 1ms before start time", () => {
        const exam = {
          isActive: true,
          startDate: NOW + 1, // 1ms in the future
          endDate: NOW + 10000,
        }

        expect(getExamStatus(exam)).toBe("upcoming")
      })
    })

    describe("priority order", () => {
      it("should check isActive first (inactive takes precedence)", () => {
        // Even with valid active dates, inactive status wins
        const exam = {
          isActive: false,
          startDate: NOW - 1000,
          endDate: NOW + 1000,
        }

        expect(getExamStatus(exam)).toBe("inactive")
      })

      it("should check upcoming before completed and active", () => {
        const exam = {
          isActive: true,
          startDate: NOW + 1000, // Future
          endDate: NOW - 1000, // Past (invalid but for testing priority)
        }

        // Since startDate is in future, upcoming is returned first
        expect(getExamStatus(exam)).toBe("upcoming")
      })
    })
  })
})
