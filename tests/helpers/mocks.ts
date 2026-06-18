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
// Retourne un doc enrichi : Doc<"questions"> + explanation/references joints.
// Côté prod, explanation/references vivent dans questionExplanations et sont
// merge-joints par le serveur (getQuestionById, scoreQuizAnswers,
// _getQuestionsPageForExport). Les composants review/results reçoivent donc
// un objet enrichi — ce factory reflète cette shape pour les tests.
export type MockQuestionDoc = Doc<"questions"> & {
  explanation: string
  references?: string[]
}

export const createMockQuestionDoc = (
  overrides?: Partial<MockQuestionDoc>,
): MockQuestionDoc =>
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
  }) as MockQuestionDoc

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
