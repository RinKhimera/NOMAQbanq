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

- `(app-pages)/` - Public marketing pages (landing, about, domains, FAQ)
- `(auth)/` - Authentication pages with navbar + footer layout
- `(dashboard)/` - Student dashboard with sidebar (requires auth + onboarding)
- `(admin)/` - Admin dashboard with sidebar (requires admin role)
- `adminn/` - Legacy admin route (separate from route groups)

**Key Rule**: All layouts in route groups are client components (`"use client"`) because they use Convex hooks or client-side navigation.

### 2. Authentication & Authorization Flow

```typescript
// Middleware protects routes and redirects authenticated users
// See: middleware.ts
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/admin(.*)"])

// User roles defined in Convex schema
role: v.union(v.literal("admin"), v.literal("user"))

// Admin protection component wraps admin pages
<AdminProtection>{children}</AdminProtection>  // See: components/AdminProtection.tsx

// Onboarding guard redirects users without username
<OnboardingGuard />  // See: components/shared/OnboardingGuard.tsx
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

## Data Flow Example

```
User Action (Component)
  → useQuery/useMutation hook
    → Convex function (convex/*.ts)
      → Auth check via ctx.auth
        → Database operation via ctx.db
          → Real-time sync to all clients
```

## Gotchas

- **Clerk Webhook**: User creation happens via webhook in `convex/http.ts`, not directly
- **Role Assignment**: New users default to "user" role; admin role must be manually set in database
- **Onboarding Flow**: Users without `username` are redirected to `/dashboard/onboarding`
- **Exam Timing**: Exam `startDate`/`endDate` stored as Unix timestamps (milliseconds)
- **Question Options**: Must have 4-5 options; correctAnswer must match one option exactly

## Reference Files

- Route organization: `app/(route-group)/layout.tsx`
- Database schema: `convex/schema.ts`
- Navigation menus: `constants/index.tsx`
- Form schemas: `schemas/`
- Medical domains data: `data/domains.ts`
- User hook pattern: `hooks/useCurrentUser.ts`
- Component structure examples: `app/(app-pages)/*/_components/`
