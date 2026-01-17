# CLAUDE.md - NOMAQbanq

## Project Overview

NOMAQbanq is the first French-language platform for EACMC Part I medical exam preparation. It provides 5000+ MCQs, mock exams, and progress tracking for medical students.

## Tech Stack

- **Frontend:** Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict)
- **Backend:** Convex (serverless functions, real-time database)
- **Auth:** Clerk with webhook sync to Convex
- **UI:** shadcn/ui components, Tailwind CSS v4, Radix UI
- **Media Storage:** Bunny CDN (Storage Zone + Pull Zone)
- **Testing:** Vitest, Testing Library, convex-test

## Key Libraries

- **Animations:** `motion` (Framer Motion v12) - use `motion/react` import
- **Icons:** `@tabler/icons-react` (primary), `lucide-react`
- **Dates:** `date-fns` for date manipulation
- **Charts:** `recharts` for data visualizations
- **Drag & Drop:** `@dnd-kit` for sortable lists
- **File Upload:** `react-dropzone` for drag & drop file selection
- **Image Crop:** `react-easy-crop` for avatar cropping
- **Lightbox:** `yet-another-react-lightbox` for image zoom/gallery

## Essential Commands

```bash
npm run dev              # Start dev server with Turbopack
npm run build-check      # Type check + lint (run before commits)
npm run test:all         # Run all tests (frontend + Convex backend)
npm run test:coverage    # Run tests with coverage report
npm run test:ui          # Interactive test UI
```

## Project Structure

- `app/(dashboard)/` - Student pages (protected)
- `app/(admin)/` - Admin pages (admin role required)
- `app/(marketing)/` - Public landing pages
- `convex/` - Backend: queries, mutations, schema
- `components/ui/` - shadcn/ui components
- `components/shared/` - Shared components
- `components/quiz/` - Quiz components (question-card, calculator, session/)
- `schemas/` - Zod validation schemas
- `tests/` - Test files (mirrors source structure)

### User-Facing Routes (French)

All user-facing routes MUST use French names for consistency:

| Route | Description |
|-------|-------------|
| `/dashboard` | Tableau de bord principal |
| `/dashboard/examen-blanc` | Liste des examens blancs |
| `/dashboard/examen-blanc/[id]` | Détails d'un examen |
| `/dashboard/examen-blanc/[id]/evaluation` | Interface de passage d'examen |
| `/dashboard/examen-blanc/[id]/resultats` | Résultats de l'examen |
| `/dashboard/entrainement` | Sessions d'entraînement |
| `/dashboard/entrainement/[id]` | Session en cours |
| `/dashboard/entrainement/[id]/results` | Résultats de session |
| `/dashboard/profil` | Profil utilisateur |

**Note:** Admin routes (`/admin/*`) can remain in English as they are internal.

## Key Conventions

- **Language:** All UI text MUST be in French with proper accents (É, è, ê, à, ç, etc.)
- **Routes:** User-facing routes MUST be in French (see route table above)
- **Functions:** Use arrow functions exclusively
- **Auth:** Always use `useCurrentUser` hook for user data; verify roles server-side in Convex
- **Components:** Use existing shadcn/ui components from `components/ui/`
- **Forms:** React Hook Form + Zod validation (schemas in `schemas/`)
- **Loading states:** Handle loading/error states with appropriate UI feedback
- **Typography:** Use `font-display` class for headings (Poppins font)
- **Navigation:** Route URLs are centralized in `constants/index.tsx` - update there when adding/changing routes

## Database (Convex)

Key tables: `users`, `questions`, `questionStats`, `exams`, `examParticipations`, `examAnswers`, `trainingParticipations`, `trainingAnswers`, `products`, `transactions`, `userAccess`

- Schema defined in `convex/schema.ts`
- Roles: `user` (student) and `admin`
- Normalized data model: exam participations are separate from exams
- Payment system: Stripe integration with `userAccess` table for time-limited access

### Aggregation Pattern (`questionStats`)

The `questionStats` table is an **aggregation table** that maintains pre-computed counts to avoid expensive full table scans:

- **Structure:** `{ domain: string, count: number }` with one row per domain + one for total (`"__total__"`)
- **Updated atomically** by `createQuestion`, `deleteQuestion`, `updateQuestion` mutations
- **Reserved key:** `"__total__"` is reserved - domain names cannot use this value
- **Migration:** Run `npx convex run questions:seedQuestionStats` after initial deployment to populate stats from existing questions

This pattern reduces `getQuestionStats` bandwidth from O(n) documents to O(d) where d = number of domains (~20).

## Testing Requirements

- Coverage thresholds: 75% (statements, branches, functions, lines)
- Frontend tests (`tests/`) use happy-dom environment
- Convex backend tests (`tests/convex/`) use edge-runtime environment
- Run `npm run test:all` before pushing changes

## Important Patterns

- Page-specific components go in `app/**/[page]/_components/`
- Use cursor-based pagination for large datasets
- Clerk webhooks sync user data to Convex via `convex/http.ts`
- Error tracking via Sentry (configured in `sentry.*.config.ts`)
- **HTTP Actions (CORS):** All custom HTTP routes in `convex/http.ts` must include CORS headers and OPTIONS preflight handlers for browser requests

## Animation & UI Patterns

- **Motion library:** Always import from `motion/react`, use `useReducedMotion()` for accessibility
- **Staggered animations:** Use `delay` prop with incremental values (0.1, 0.2, 0.3...)
- **Glass morphism:** Combine `bg-white/80 backdrop-blur-sm` with subtle borders
- **Charts (Recharts):** Use `ReferenceLine` for threshold lines, `CustomTooltip` for styled tooltips
- **CSS utilities:** `perspective-1000`, `preserve-3d`, `font-display` classes available in globals.css

## Session Components (Quiz UI)

Shared components for training and exam sessions are in `components/quiz/session/`.

### Available Components

| Component | Description |
|-----------|-------------|
| `SessionHeader` | Sticky header with progress, optional timer, finish button |
| `QuestionNavigator` | Question grid (desktop sidebar + mobile FAB) |
| `SessionToolbar` | Floating buttons (calculator, lab values, scroll-to-top) |
| `SessionNavigation` | Previous/Next/Flag navigation buttons |
| `FinishDialog` | Confirmation dialog with stats before submission |

### Usage

```tsx
import {
  SessionHeader,
  QuestionNavigator,
  SessionToolbar,
  SessionNavigation,
  FinishDialog,
} from "@/components/quiz/session"
```

### Configuration by Mode

| Feature | Training (`emerald`) | Exam (`blue`) |
|---------|---------------------|---------------|
| Timer | ❌ `showTimer: false` | ✅ `showTimer: true` |
| Calculator | ✅ | ✅ |
| Lab Values | ✅ | ✅ |
| Question Flagging | ✅ | ✅ |
| Question Locking | ❌ | ✅ (via `isQuestionLocked`) |
| Pause Button | ❌ | ✅ (via `examActions`) |

### Example: SessionHeader

```tsx
<SessionHeader
  config={{
    mode: "training", // or "exam"
    showTimer: false,
    accentColor: "emerald", // or "blue"
  }}
  currentIndex={currentIndex}
  totalQuestions={totalQuestions}
  answeredCount={answeredCount}
  onFinish={() => setShowFinishDialog(true)}
  title="Entraînement"
  icon={<Brain className="h-5 w-5 text-white" />}
  backUrl="/dashboard/entrainement"
  // Exam-only: examActions={{ onTakePause, canTakePause }}
/>
```

### QuestionNavigator with Locking (Exam)

```tsx
<QuestionNavigator
  questions={questions}
  answers={navigatorAnswers}
  flaggedQuestions={flaggedQuestions}
  currentIndex={currentIndex}
  onNavigate={goToQuestion}
  isQuestionLocked={isQuestionLocked} // Exam: locks questions during pause
  accentColor="blue"
/>
```

## Payment System

- Stripe checkout flow via `convex/stripe.ts` HTTP actions
- Access types: `exam` (mock exams) and `training` (learning bank)
- Time-cumulative: new purchases extend existing access rather than replacing
- Admin bypass: admins have full access without payment checks

## Media Storage (Bunny CDN)

Image uploads for questions and user avatars are handled via Bunny CDN.

### Architecture

```
Client (FormData) → Convex HTTP Action → Bunny Storage API → Bunny CDN (Pull Zone)
```

- **Storage Zone:** Stores original files (`storage.bunnycdn.com`)
- **Pull Zone:** Serves optimized images with automatic transformations (`cdn.nomaqbanq.ca`)
- **API keys stay server-side:** Upload/delete only happens in Convex HTTP actions

### Environment Variables (Convex Dashboard)

```bash
BUNNY_STORAGE_ZONE_NAME=your-storage-zone
BUNNY_STORAGE_API_KEY=your-api-key
BUNNY_CDN_HOSTNAME=cdn.nomaqbanq.ca  # Without https://
```

### Key Files

| File | Purpose |
|------|---------|
| `convex/lib/bunny.ts` | Core service: upload, delete, URL helpers |
| `convex/http.ts` | HTTP routes: `/api/upload/avatar`, `/api/upload/question-image` |
| `components/admin/question-image-uploader.tsx` | Multi-image upload with drag & drop reordering |
| `components/shared/avatar-uploader.tsx` | Avatar upload with circular crop |
| `components/shared/question-image-gallery.tsx` | Image display with lightbox zoom |

### Schema Fields

```typescript
// questions table
images: v.optional(v.array(v.object({
  url: v.string(),           // CDN URL for display
  storagePath: v.string(),   // Storage path for deletion
  order: v.number(),         // Display order
})))

// users table
avatarStoragePath: v.optional(v.string())  // For cleanup on avatar change
```

### Image Optimization (URL params)

Bunny Optimizer transforms images on-the-fly via URL parameters:

```typescript
// Thumbnail: ?width=200&height=200&crop=fit&quality=80
// Display:   ?width=800&quality=85
// Full size: ?width=1200&quality=90
```

### Usage Example

```tsx
import { QuestionImageUploader } from "@/components/admin/question-image-uploader"

<QuestionImageUploader
  questionId={question._id}
  images={question.images || []}
  onImagesChange={setImages}
  maxImages={10}
/>
```

## Authentication Race Conditions

When using Convex queries that require authentication (using `getCurrentUserOrThrow`), a race condition can occur on page reload where the query executes before Clerk has finished loading the auth state.

### Solution: Skip queries until authenticated

Use `useConvexAuth` hook and pass `"skip"` to queries when not authenticated:

```tsx
import { useConvexAuth, useQuery } from "convex/react"

const MyComponent = () => {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()

  // Skip query until authenticated to avoid race condition on page reload
  const data = useQuery(
    api.myModule.myQuery,
    isAuthenticated ? { arg: value } : "skip"
  )

  // Handle loading state (auth loading OR data loading)
  if (isAuthLoading || data === undefined) {
    return <LoadingSpinner />
  }

  // Now safe to use data
  return <div>{data}</div>
}
```

### For `usePaginatedQuery`:

```tsx
const { results, status, loadMore } = usePaginatedQuery(
  api.myModule.paginatedQuery,
  isAuthenticated ? {} : "skip",
  { initialNumItems: 10 }
)
```

### Key points:
- Always check `isAuthLoading` in loading conditions
- Pass `"skip"` (string literal) as the second argument when not authenticated
- For queries without required args, use `isAuthenticated ? undefined : "skip"`
- For queries with args, use `isAuthenticated ? { ...args } : "skip"`
