import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { vi } from "vitest"
import type { QuizQuestion } from "@/components/quiz/runner/types"

// ===== Router Mock =====
// Mock volontairement partiel : seuls les membres réellement appelés par les
// composants sont fournis. Le cast absorbe ceux que Next ajoute à l'interface
// au fil des versions, qui casseraient sinon le type-check de toute la suite.
export const mockRouter = (
  overrides?: Partial<AppRouterInstance>,
): AppRouterInstance =>
  ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    ...overrides,
  }) as unknown as AppRouterInstance

// ===== Better Auth User Mock =====
// Forme exposée par `authClient.useSession().data.user` (cf. lib/auth-client.ts).
export type BetterAuthUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  role: "user" | "admin"
  username: string | null
  bio: string | null
}

export const createMockBetterAuthUser = (
  overrides?: Partial<BetterAuthUser>,
): BetterAuthUser => ({
  id: "test_user_id",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  image: "https://example.com/avatar.png",
  role: "user",
  username: null,
  bio: null,
  ...overrides,
})

// ===== Better Auth Session Mock =====
// Forme retournée par `authClient.useSession()` : { data, isPending, error }.
type AuthSessionState = {
  data: { user: BetterAuthUser } | null
  isPending: boolean
  error: null
}

export const mockAuthSession = (
  overrides?: Partial<AuthSessionState>,
): AuthSessionState => ({
  data: null,
  isPending: false,
  error: null,
  ...overrides,
})

// ===== Current User Hook Mock =====
// Reflète la forme retournée par `useCurrentUser` (wrapper de Better Auth).
// On garde une forme simple (BetterAuthUser) ; les tests castent au besoin vers
// le type inféré exact du hook au point d'appel de `mockReturnValue`.
type CurrentUserReturn = {
  currentUser: BetterAuthUser | null | undefined
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

// ===== Question Doc Factory =====
// Forme-pont enrichie de sa correction, comme la reçoivent les composants de
// résultats (le serveur joint `questionExplanations` à la révélation).
export type MockQuestionDoc = QuizQuestion

export const createMockQuestionDoc = (
  overrides?: Partial<MockQuestionDoc>,
): MockQuestionDoc => ({
  _id: "q1",
  question: "Quelle est la capitale de la France ?",
  options: ["Paris", "Lyon", "Marseille", "Bordeaux"],
  images: [],
  correctAnswer: "Paris",
  explanation: "Paris est la capitale de la France.",
  objectifCMC: "Objectif 1",
  domain: "Général",
  ...overrides,
})
