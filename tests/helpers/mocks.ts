import { vi } from "vitest"
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import type { Doc } from "@/convex/_generated/dataModel"

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
