# CLAUDE.md - NOMAQbanq

## Project Overview

NOMAQbanq is the first French-language platform for EACMC Part I medical exam preparation. It provides 5000+ MCQs, mock exams, and progress tracking for medical students.

## Tech Stack

- **Frontend:** Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict)
- **Backend:** Convex (serverless functions, real-time database)
- **Auth:** Clerk with webhook sync to Convex
- **UI:** shadcn/ui components, Tailwind CSS v4, Radix UI
- **Testing:** Vitest, Testing Library, convex-test

## Key Libraries

- **Animations:** `motion` (Framer Motion v12) - use `motion/react` import
- **Icons:** `@tabler/icons-react` (primary), `lucide-react`
- **Dates:** `date-fns` for date manipulation
- **Charts:** `recharts` for data visualizations
- **Drag & Drop:** `@dnd-kit` for sortable lists

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
- `schemas/` - Zod validation schemas
- `tests/` - Test files (mirrors source structure)

## Key Conventions

- **Language:** All UI text MUST be in French
- **Functions:** Use arrow functions exclusively
- **Auth:** Always use `useCurrentUser` hook for user data; verify roles server-side in Convex
- **Components:** Use existing shadcn/ui components from `components/ui/`
- **Forms:** React Hook Form + Zod validation (schemas in `schemas/`)
- **Loading states:** Handle loading/error states with appropriate UI feedback

## Database (Convex)

Key tables: `users`, `questions`, `exams`, `examParticipations`, `examAnswers`, `learningBankQuestions`

- Schema defined in `convex/schema.ts`
- Roles: `user` (student) and `admin`
- Normalized data model: exam participations are separate from exams

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
