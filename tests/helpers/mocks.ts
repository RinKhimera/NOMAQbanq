import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { vi } from "vitest"
import type { SessionQuestion } from "@/components/quiz/session/types"
import type { Doc, Id } from "@/convex/_generated/dataModel"

// ===== Router Mock =====
export const mockRouter = (
  overrides?: Partial<AppRouterInstance>,
): AppRouterInstance => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
  ...overrides,
})

// ===== ConvexAuth Mock =====
type ConvexAuthState = {
  isAuthenticated: boolean
  isLoading: boolean
}

export const mockConvexAuth = (
  overrides?: Partial<ConvexAuthState>,
): ConvexAuthState => ({
  isAuthenticated: false,
  isLoading: false,
  ...overrides,
})

// ===== Current User Hook Mock =====
type CurrentUserReturn = {
  currentUser: Doc<"users"> | null | undefined
  isLoading: boolean
  isAuthenticated: boolean
}

export const mockCurrentUser = (
  overrides?: Partial<CurrentUserReturn>,
): CurrentUserReturn => ({
  currentUser: null,
  isLoading: false,
  isAuthenticated: false,
  ...overrides,
})

// ===== User Doc Factory =====
export const createMockUserDoc = (
  overrides?: Partial<Doc<"users">>,
): Doc<"users"> =>
  ({
    _id: "test_user_id" as Doc<"users">["_id"],
    _creationTime: Date.now(),
    name: "Test User",
    email: "test@example.com",
    image: "https://example.com/avatar.png",
    role: "user" as const,
    tokenIdentifier: "https://clerk.dev|test_user",
    externalId: "clerk_test",
    ...overrides,
  }) as Doc<"users">

// ===== Question Doc Factory =====
export const createMockQuestionDoc = (
  overrides?: Partial<Doc<"questions">>,
): Doc<"questions"> =>
  ({
    _id: "q1" as Id<"questions">,
    _creationTime: Date.now(),
    question: "Quelle est la capitale de la France ?",
    options: ["Paris", "Lyon", "Marseille", "Bordeaux"],
    correctAnswer: "Paris",
    explanation: "Paris est la capitale de la France.",
    objectifCMC: "Objectif 1",
    domain: "Général",
    ...overrides,
  }) as Doc<"questions">

// ===== Session Question Factory =====
export const createMockSessionQuestion = (
  overrides?: Partial<SessionQuestion>,
): SessionQuestion => ({
  _id: "q1" as Id<"questions">,
  question: "Quelle est la capitale de la France ?",
  options: ["Paris", "Lyon", "Marseille", "Bordeaux"],
  correctAnswer: "Paris",
  explanation: "Paris est la capitale de la France.",
  objectifCMC: "Objectif 1",
  domain: "Général",
  ...overrides,
})
