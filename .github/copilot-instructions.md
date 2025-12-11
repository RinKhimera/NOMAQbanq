# NOMAQbanq - AI Coding Agent Instructions

## Project Overview

NOMAQbanq is a French-language medical exam preparation platform for EACMC Part I, built with Next.js 15, Convex (backend-as-a-service), and Clerk (authentication). The app features a question bank system, mock exams, and role-based access control for students and administrators.

## Tech Stack & Architecture

- **Framework**: Next.js 15 (App Router) with React 19, TypeScript
- **Backend**: Convex (real-time database + serverless functions)
- **Authentication**: Clerk with webhook integration
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Forms**: React Hook Form + Zod validation
- **State Management**: Convex React hooks (`useQuery`, `useMutation`)

## Critical Project Patterns

### 1. Route Group Architecture

The app uses Next.js route groups to organize distinct application sections:

- `(marketing)/` - Public marketing pages (landing, about, domains, FAQ)
- `(auth)/` - Authentication pages with navbar + footer layout
- `(dashboard)/` - Student dashboard with sidebar (requires auth + onboarding)
- `(admin)/` - Admin dashboard with sidebar (requires admin role)

**Key Rule**: All layouts in route groups are client components (`"use client"`) because they use Convex hooks or client-side navigation.

### 2. Authentication & Authorization Flow

```typescript
// Middleware protects routes and redirects authenticated users
// See: middleware.ts
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/admin(.*)"])

// User roles defined in Convex schema
role: v.union(v.literal("admin"), v.literal("user"))

// Admin protection component wraps admin pages
<AdminProtection>{children}</AdminProtection>  // See: components/admin-protection.tsx

// Onboarding guard redirects users without username
<OnboardingGuard />  // See: components/shared/onboarding-guard.tsx
```

**Authorization Pattern**: Use `getCurrentUser` query to get current user, `isCurrentUserAdmin` query for admin checks. Never expose admin mutations without server-side role verification.

### 3. Convex Backend Structure

Convex functions are organized by domain in `convex/`:

```typescript
// Standard exports pattern
export const functionName = query/mutation/action({
  args: { /* zod-like validation */ },
  handler: async (ctx, args) => { /* implementation */ }
})

// Internal mutations for webhooks (not callable from client)
export const upsertFromClerk = internalMutation({ ... })
```

**Key Files**:

- `convex/schema.ts` - Database tables: users, questions, exams, learningBankQuestions
- `convex/http.ts` - Clerk webhook handler (user.created, user.updated, user.deleted)
- `convex/users.ts` - User queries/mutations with role-based logic
- `convex/questions.ts` - Question management
- `convex/exams.ts` - Mock exam system with participant tracking

**Data Access Pattern**: Always use `useQuery(api.*.functionName)` in components, never direct database calls.

### 4. Form Validation with Zod

All forms use centralized Zod schemas in `schemas/`:

```typescript
// schemas/question.ts
export const questionFormSchema = z.object({ ... })
export type QuestionFormValues = z.infer<typeof questionFormSchema>

// Helper utilities for cleaning data
export const filterValidOptions = (options: string[]) => { ... }
```

**Form Pattern**:

```tsx
const MyFormComponent = () => {
  const { currentUser, isLoading: userLoading } = useCurrentUser()
  const createMutation = useMutation(api.*.create)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ... }
  })

  const onSubmit = async (values: FormValues) => {
    await createMutation({ ...values })
    toast.success("Success message")
  }

  if (userLoading) return <Loader />

  return <Form {...form} />
}
```

### 5. UI Components & Styling

- **Component Library**: shadcn/ui in `components/ui/` (don't modify these directly)
- **Custom Components**: Use `cn()` utility from `lib/utils.ts` for className merging
- **Button Variants**: Custom variants defined in `components/ui/button.tsx`:
  - `btn_modern` - Gradient blue buttons for CTAs
  - `btn_secondary` - Outlined blue buttons
  - `btn_modern_outline` - Outlined with hover effects
  - `badge` - Gradient badge style

**Styling Convention**: Use Tailwind utilities. CSS custom properties defined in `globals.css` for theme colors (e.g., `hsl(var(--primary))`).

### 6. Navigation & Layout Components

Shared layout components in `components/shared/`:

```tsx
// Reusable sidebar for dashboard/admin
<AppSidebar
  variant="inset"
  navigation={dashboardNavigation} // from constants/index.tsx
  homeUrl="/dashboard"
  userComponent={<GenericNavUser requireAdmin={false} />}
/>
```

Navigation constants defined in `constants/index.tsx` with icons from `@tabler/icons-react` and `lucide-react`.

## Development Commands

```bash
npm run dev              # Start dev server with Turbopack
npm run build-check      # Type check + lint before build
npm run fix-lint         # Auto-fix ESLint issues
```

**Important**: Convex requires a separate backend (configured via `NEXT_PUBLIC_CONVEX_URL`). Changes to `convex/` files auto-deploy when Convex dev server is running.

## Common Workflows

### Adding a New Page

1. Determine route group based on auth requirements
2. Create page in appropriate `app/` subdirectory
3. Add `"use client"` if using Convex hooks or interactive components
4. Update navigation in `constants/index.tsx` if adding to sidebar

### Creating a New Convex Function

1. Add function to appropriate file in `convex/`
2. Export with proper type: `query`, `mutation`, or `internalMutation`
3. Define strict args validation using Convex validators (`v.*`)
4. Use `await ctx.auth.getUserIdentity()` for auth checks
5. Import in component: `import { api } from "@/convex/_generated/api"`

### Adding a Form

1. Create Zod schema in `schemas/`
2. Use React Hook Form with `zodResolver`
3. Implement Convex mutation for data submission
4. Use `toast` from `sonner` for user feedback
5. Handle loading states with mutation status

### Creating Page-Specific Components

1. Create a `_components` folder within the page's directory
2. Add components specific to that page inside `_components`
3. Use arrow function syntax for all component exports
4. Import and use in the parent `page.tsx`

## File Naming Conventions

### Component Files (`.tsx`)

- **Use kebab-case** for all component files to maintain consistency with shadcn/ui
- Component exports remain in PascalCase

```
components/
├── ui/                          # shadcn/ui (don't modify)
│   ├── button.tsx
│   ├── alert-dialog.tsx
│
├── admin/                       # Admin-specific components
│   ├── exams-list.tsx          # ✅ kebab-case
│   ├── stat-card.tsx
│   ├── question-form.tsx
│   ├── questions-list.tsx
│   ├── modals/
│
├── marketing/                   # Marketing page components
│   ├── domain-card.tsx
│   ├── testimonials-carousel.tsx
│
├── shared/                      # Shared layout components
│   ├── app-sidebar.tsx
│   ├── dashboard-shell.tsx     # Unified dashboard layout
│   ├── marketing-shell.tsx     # Unified marketing layout
│   ├── generic-nav-user.tsx
│   ├── onboarding-guard.tsx
│   └── account/
│       └── account-page.tsx
│
├── layout/                      # Layout components
│   ├── footer.tsx
│   ├── legal-layout.tsx
│
├── quiz/                        # Quiz-related components
│   ├── question-card/          # Unified QuestionCard with variants
│   │   ├── index.tsx           # Main component (default, exam, review)
│   │   ├── answer-option.tsx   # Reusable answer option sub-component
│   │   ├── question-actions.tsx # Action creators & dropdown
│   │   └── types.ts            # TypeScript interfaces
│   ├── quiz-progress.tsx
│   ├── quiz-results.tsx
│
├── admin-protection.tsx         # Admin role guard
├── nav-bar.tsx                  # Root-level components
├── theme-provider.tsx
```

### Hooks, Functions & Utilities (`.ts`)

- **Use camelCase** for hooks, functions, and library files
- Keep consistency with React conventions

```
hooks/
├── useCurrentUser.ts           # ✅ camelCase
├── use-mobile.ts               # shadcn hook (exception)
├── use-media-query.ts          # shadcn hook (exception)

lib/
├── utils.ts                    # ✅ camelCase
├── exam-status.ts              # Utility file
```

### Import Examples

```tsx
// Component imports (kebab-case files)
import { ExamsList } from "@/components/admin/exams-list"
import NavBar from "@/components/nav-bar"
import {
  QuestionCard,
  createEditAction,
  createViewAction,
} from "@/components/quiz/question-card"
import { GenericNavUser } from "@/components/shared/generic-nav-user"
import { AlertDialog } from "@/components/ui/alert-dialog"
// shadcn/ui imports (kebab-case - don't modify)
import { Button } from "@/components/ui/button"
// Hook imports (camelCase files)
import { useCurrentUser } from "@/hooks/useCurrentUser"
```

## QuestionCard Component

The unified `QuestionCard` component (`components/quiz/question-card/`) supports three variants:

### Variants

- **`default`** - Compact card for lists (admin views, learning bank). Truncated question, 2-column options grid, action dropdown.
- **`exam`** - Full interactive QCM mode. Complete question text, large clickable options, selection highlighting, image support.
- **`review`** - Post-submission review. Expandable, shows correct/incorrect highlighting, explanation and references.

### Usage Examples

```tsx
// Admin list view
<QuestionCard
  variant="default"
  question={question}
  questionNumber={1}
  actions={[
    createEditAction(() => handleEdit(question)),
    createDeleteAction(() => handleDelete(question._id)),
  ]}
/>

// Interactive exam
<QuestionCard
  variant="exam"
  question={question}
  selectedAnswer={currentAnswer}
  onAnswerSelect={handleAnswerSelect}
  showImage={true}
/>

// Quiz results review
<QuestionCard
  variant="review"
  question={question}
  userAnswer={userAnswers[index]}
  questionNumber={index + 1}
  isExpanded={expandedQuestions.has(index + 1)}
  onToggleExpand={handleToggleExpand}
/>
```

### Action Helpers

```tsx
import {
  createAddAction,
  createDeleteAction,
  createEditAction,
  createPermanentDeleteAction,
  createRemoveAction,
  createViewAction,
} from "@/components/quiz/question-card"
```

## Critical Conventions

### Code Style

- **Function Syntax**: Always use arrow functions for all function declarations

  ```tsx
  // ✅ Correct
  const MyComponent = () => { ... }
  export const handleSubmit = async (data: FormData) => { ... }

  // ❌ Avoid
  function MyComponent() { ... }
  export function handleSubmit(data: FormData) { ... }
  ```

- **Component Structure**: Organize page-specific components in a `_components` subdirectory within the page's folder
  ```
  app/
    (dashboard)/
      dashboard/
        learning/
          page.tsx
          _components/
            LearningHeader.tsx
            QuestionCard.tsx
  ```

### User Data Access

- **Always use `useCurrentUser` hook** from `@/hooks/useCurrentUser` for accessing current user data
- **Handle loading states** with the returned `isLoading` flag

  ```tsx
  import { useCurrentUser } from "@/hooks/useCurrentUser"

  const MyComponent = () => {
    const { currentUser, isLoading, isAuthenticated } = useCurrentUser()

    if (isLoading) {
      return <Loader /> // Always show loader during loading
    }

    if (!currentUser) {
      return <NotAuthenticated />
    }

    // Use currentUser safely here
  }
  ```

### General Conventions

- **Language**: All UI text in French (e.g., "Connexion", "Tableau de bord")
- **Image Sources**: Configure remote patterns in `next.config.ts` for Clerk/Pexels
- **Error Handling**: Use `error.tsx` files in route groups for error boundaries
- **Not Found**: Use `not-found.tsx` for custom 404 pages
- **Environment Variables**: Prefix client vars with `NEXT_PUBLIC_`

## React Compiler & ESLint Rules

This project uses React 19 with the React Compiler, which enforces strict rules for optimal performance and correctness. Follow these patterns to avoid linting errors.

### 1. Purity Rules - No Side Effects During Render

Components and hooks must be **pure functions**. Never call impure functions or perform side effects during render.

**❌ AVOID:**

```tsx
// ❌ Don't use Date.now() during render
function Component() {
  const now = Date.now() // WRONG - impure function
  return <div>{now}</div>
}

// ❌ Don't use Math.random() during render
function Component() {
  const width = `${Math.floor(Math.random() * 40) + 50}%` // WRONG
  return <div style={{ width }} />
}

// ❌ Don't mutate objects during render
function Component({ items }) {
  items.push(newItem) // WRONG - mutation
  return <List items={items} />
}
```

**✅ CORRECT PATTERNS:**

```tsx
// ✅ Use useState initializer for one-time impure calls
function Component() {
  const [now] = useState(() => Date.now()) // OK - runs once
  return <div>{now}</div>
}

// ✅ Use useState with setInterval for periodic updates
function Component() {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return <div>{now}</div>
}

// ✅ Use useState initializer for Math.random()
function Component() {
  const [width] = useState(() => `${Math.floor(Math.random() * 40) + 50}%`)
  return <div style={{ width }} />
}

// ✅ Create new arrays/objects instead of mutating
function Component({ items }) {
  const newItems = [...items, newItem] // OK - new array
  return <List items={newItems} />
}
```

### 2. setState in useEffect - Synchronizing with External Systems

Avoid calling `setState` synchronously in `useEffect` when the state change is triggered by prop/state changes. Use the "storing information from previous renders" pattern instead.

**❌ AVOID:**

```tsx
// ❌ Don't call setState in effect for derived state
function Component({ userId }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    setUser(fetchUser(userId)) // WRONG - creates extra render
  }, [userId])

  return <div>{user?.name}</div>
}

// ❌ Don't synchronize state with props in effect
function QuestionList({ domainFilter }) {
  const [selectedDomain, setSelectedDomain] = useState(null)

  useEffect(() => {
    setSelectedDomain(domainFilter) // WRONG
  }, [domainFilter])
}
```

**✅ CORRECT PATTERNS:**

```tsx
// ✅ Derive state during render (no useEffect needed)
function Component({ userId }) {
  const user = fetchUser(userId) // OK - derived during render
  return <div>{user?.name}</div>
}

// ✅ Use "storing previous renders" pattern for external data sync
function QuestionList({ questions }) {
  const [filteredQuestions, setFilteredQuestions] = useState(questions)
  const [prevQuestions, setPrevQuestions] = useState(questions)

  // Detect when external data changes during render
  if (questions !== prevQuestions) {
    setPrevQuestions(questions)
    setFilteredQuestions(questions)
  }

  return <List items={filteredQuestions} />
}

// ✅ Call handler functions instead of useEffect
function Component({ onDomainChange }) {
  const handleDomainChange = (domain) => {
    onDomainChange(domain) // OK - explicit handler
  }

  return <Select onChange={handleDomainChange} />
}

// ✅ Use useSyncExternalStore for external subscriptions
function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (callback) => {
      const mediaQuery = window.matchMedia(query)
      mediaQuery.addEventListener("change", callback)
      return () => mediaQuery.removeEventListener("change", callback)
    },
    () => window.matchMedia(query).matches,
    () => false // Server-side default
  )
}
```

### 3. Form Watching with React Hook Form

The `form.watch()` method is incompatible with React Compiler memoization. Use `useWatch()` instead.

**❌ AVOID:**

```tsx
// ❌ Don't use form.watch() directly
function FormComponent() {
  const form = useForm()
  const numberOfQuestions = form.watch("numberOfQuestions") // WRONG

  return <div>{numberOfQuestions}</div>
}
```

**✅ CORRECT:**

```tsx
// ✅ Use useWatch() from react-hook-form
import { useWatch } from "react-hook-form"

function FormComponent() {
  const form = useForm()
  const numberOfQuestions = useWatch({
    control: form.control,
    name: "numberOfQuestions",
  })

  return <div>{numberOfQuestions}</div>
}
```

## Data Flow Example

```
User Action (Component)
  → useQuery/useMutation hook
    → Convex function (convex/*.ts)
      → Auth check via ctx.auth
        → Database operation via ctx.db
          → Real-time sync to all clients
```

## React Hooks & Refs Best Practices

### Refs Usage Rules

Refs hold values that aren't used for rendering. Unlike state, changing a ref doesn't trigger a re-render. Follow these critical rules:

**❌ NEVER do this:**

```typescript
// ❌ Don't read ref during render
function Component() {
  const ref = useRef(0)
  const value = ref.current // WRONG - reading during render
  return <div>{value}</div>
}

// ❌ Don't modify ref during render
function Component({ value }) {
  const ref = useRef(null)
  ref.current = value // WRONG - modifying during render
  return <div />
}
```

**✅ DO this instead:**

```typescript
// ✅ Read/write refs in effects or event handlers
function Component() {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) {
      console.log(ref.current.offsetWidth) // OK in effect
    }
  })

  const handleClick = () => {
    console.log(ref.current) // OK in event handler
  }

  return <div ref={ref} onClick={handleClick} />
}

// ✅ Use state for UI values that need re-renders
function Component() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}

// ✅ Lazy initialization of ref value (one-time setup)
function Component() {
  const ref = useRef(null)

  // Initialize only once on first use
  if (ref.current === null) {
    ref.current = expensiveComputation() // OK - lazy initialization
  }

  const handleClick = () => {
    console.log(ref.current) // Use the initialized value
  }

  return <button onClick={handleClick}>Click</button>
}
```

**Ref Detection Heuristics:**

The React Compiler detects refs through:

- Values returned from `useRef()` or `React.createRef()`
- Identifiers named `ref` or ending in `Ref` that access `.current`
- Values passed through JSX `ref` prop (e.g., `<div ref={someRef} />`)

**Key Principles:**

- **Refs are for side effects**, not rendering logic
- **State is for UI values** that should trigger re-renders
- **Only read/write `ref.current`** in effects, event handlers, or lazy initialization
- **Never access `ref.current`** during the render phase

## Gotchas

- **Clerk Webhook**: User creation happens via webhook in `convex/http.ts`, not directly
- **Role Assignment**: New users default to "user" role; admin role must be manually set in database
- **Onboarding Flow**: Users without `username` are redirected to `/dashboard/onboarding`
- **Exam Timing**: Exam `startDate`/`endDate` stored as Unix timestamps (milliseconds)
- **Question Options**: Must have 4-5 options; correctAnswer must match one option exactly

## Testing Conventions

### Test File Location & Naming

- **All tests must be placed in the `tests/` directory** at the project root
- **Use `.test.ts` or `.test.tsx`** extension for test files (NOT `.spec.ts`)
- **Mirror the source structure** inside `tests/`:
  - Source: `lib/utils.ts` → Test: `tests/lib/utils.test.ts`
  - Source: `hooks/useCalculator.tsx` → Test: `tests/hooks/useCalculator.test.tsx`
  - Source: `schemas/user.ts` → Test: `tests/schemas/user.test.ts`

```
tests/
├── lib/
│   ├── utils.test.ts           # Tests for lib/utils.ts
│   ├── exam-status.test.ts     # Tests for lib/exam-status.ts
│   └── exam-timer.test.ts      # Tests for lib/exam-timer.ts
├── hooks/
│   └── useCalculator.test.tsx  # Tests for hooks/useCalculator.tsx
└── schemas/
    ├── question.test.ts        # Tests for schemas/question.ts
    ├── exam.test.ts            # Tests for schemas/exam.ts
    └── user.test.ts            # Tests for schemas/user.ts
```

### Test Framework & Patterns

- **Framework**: Vitest with `@testing-library/react` for hooks/components
- **Coverage target**: Minimum 80% on critical utilities
- **Structure**: Use `describe` blocks for logical grouping

```typescript
import { describe, expect, it } from "vitest"

describe("FunctionName", () => {
  describe("Scenario Group", () => {
    it("should do specific behavior", () => {
      // Arrange
      const input = ...

      // Act
      const result = functionName(input)

      // Assert
      expect(result).toBe(expected)
    })
  })
})
```

### Hook Testing Pattern

```tsx
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

describe("useHookName", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ProviderIfNeeded>{children}</ProviderIfNeeded>
  )

  it("should return initial state", () => {
    const { result } = renderHook(() => useHookName(), { wrapper })
    expect(result.current.value).toBe(expectedInitialValue)
  })
})
```

### What to Test

**Critical (must have tests)**:

- Pure utility functions in `lib/`
- Zod schema validation in `schemas/`
- Custom hooks with business logic
- Data transformation functions

**Important (should have tests)**:

- Complex state management logic
- Error handling paths
- Edge cases and boundary conditions

**Nice-to-have**:

- UI component rendering
- Integration tests with Convex

## Reference Files

- Route organization: `app/(route-group)/layout.tsx`
- Database schema: `convex/schema.ts`
- Navigation menus: `constants/index.tsx`
- Form schemas: `schemas/`
- Type definitions: `types/index.ts`
- Medical domains data: `data/domains.ts`
- User hook pattern: `hooks/useCurrentUser.ts`
- Component structure examples: `app/(marketing)/*/_components/`
- Shared dashboard layout: `components/shared/dashboard-shell.tsx`
- Shared marketing layout: `components/shared/marketing-shell.tsx`
- Shared account page: `components/shared/account/account-page.tsx`
- Admin protection: `components/admin-protection.tsx`
- Navigation bar: `components/nav-bar.tsx`
- Test examples: `tests/hooks/useCalculator.test.tsx`, `tests/lib/*.test.ts`
