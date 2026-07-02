# NOMAQbanq

> The first French-language platform for EACMC Part I exam preparation

NOMAQbanq is a modern medical exam preparation web application, offering a comprehensive question bank, timed mock exams, and a personalized progress tracking system.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-green)](https://orm.drizzle.team/)
[![Neon](https://img.shields.io/badge/Neon-Postgres-blue)](https://neon.tech/)
[![Better Auth](https://img.shields.io/badge/Better%20Auth-Auth-black)](https://better-auth.com/)
[![CI](https://github.com/RinKhimera/NOMAQbanq/actions/workflows/ci.yml/badge.svg)](https://github.com/RinKhimera/NOMAQbanq/actions/workflows/ci.yml)

## ✨ Features

### For Students

- 📚 **Question Bank** - Over 3000 MCQs organized by medical domain
- ⏱️ **Mock Exams** - Exam simulations with timer, pause system, and real conditions
- 📊 **Progress Tracking** - Detailed statistics, score history, and leaderboard
- 🎯 **Targeted Training** - Training by domain (Cardiology, Neurology, etc.)
- 💡 **Detailed Explanations** - Complete corrections with references
- 🧮 **Built-in Calculator** - Scientific calculator available during exams

### For Administrators

- ➕ **Question Management** - Creation, editing and bulk import (XLSX)
- 📝 **Exam Creation** - Configure exams with dates, timer, and pause settings
- 👥 **User Management** - Administration of access, roles, and payments
- 📈 **Dashboard** - Statistics, trends, activity feed, and revenue tracking
- 💳 **Payment Management** - Manual payments and Stripe integration

## 🚀 Tech Stack

| Category       | Technologies                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Framework**  | [Next.js 16](https://nextjs.org/) (App Router, Turbopack)                                                               |
| **Language**   | [TypeScript](https://www.typescriptlang.org/)                                                                           |
| **Runtime**    | [Bun](https://bun.sh/)                                                                                                  |
| **UI**         | [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)                                       |
| **Database**   | [Neon](https://neon.tech/) Postgres + [Drizzle ORM](https://orm.drizzle.team/) (`pg` Pool)                              |
| **Auth**       | [Better Auth](https://better-auth.com/) (email/password + Google, admin roles)                                          |
| **Payments**   | [Stripe](https://stripe.com/) (Checkout Sessions + webhooks)                                                            |
| **Media**      | [AWS S3](https://aws.amazon.com/s3/) + [CloudFront](https://aws.amazon.com/cloudfront/) (avatars, question images)      |
| **Email**      | [AWS SES](https://aws.amazon.com/ses/) + [React Email](https://react.email/)                                            |
| **Monitoring** | [Sentry](https://sentry.io/) (error tracking)                                                                           |
| **Animations** | [motion](https://motion.dev/)                                                                                           |
| **Charts**     | [Recharts](https://recharts.org/)                                                                                       |
| **Forms**      | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)                                               |
| **Icons**      | [Tabler Icons](https://tabler.io/icons) (primary) + [Lucide](https://lucide.dev/) (secondary)                           |
| **Testing**    | [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) + [Playwright](https://playwright.dev/) |

## 📋 Prerequisites

- **Bun** (the project uses Bun, not npm)
- **Neon Account** - [Create an account](https://neon.tech/) (serverless Postgres)
- **Stripe Account** - [Create an account](https://stripe.com/) (for payments, optional)

## 🛠️ Installation

1. **Clone the project**

```bash
git clone https://github.com/RinKhimera/NOMAQbanq.git
cd NOMAQbanq
```

2. **Install dependencies**

```bash
bun install
```

3. **Configure environment variables**

Copy the example file and fill in your keys:

```bash
cp .env.example .env.local
```

See [`.env.example`](.env.example) for all variables. Required: `DATABASE_URL` (pooled) + `DATABASE_URL_UNPOOLED` (direct, for migrations), `BETTER_AUTH_SECRET`. Optional: Google OAuth, AWS SES, Stripe, AWS S3, Sentry.

> **Team shortcut — sync env from Vercel.** Instead of filling `.env.local` by hand, pull the shared **development** environment from Vercel on any machine:
>
> ```bash
> vercel login                 # once per machine
> vercel link                  # select team rinkhimeras-projects → project nomaqbank
> bun run env:sync             # writes a grouped .env.local from Vercel's Development scope
> ```
>
> `bun run env:sync` regenerates `.env.local` (organized into commented sections) from Vercel's `Development` scope only — preview/production are never touched. It is safe to re-run, and **refuses to overwrite** if your local file has keys not yet on Vercel (add those with `vercel env add <KEY> development`, then re-run). Re-pull at the start of a session if the Vercel OIDC token (~12 h) has expired.

4. **Apply database migrations**

```bash
bun run db:migrate
```

5. **Launch the development server**

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
NOMAQbanq/
├── app/                          # Next.js Pages (App Router)
│   ├── (marketing)/              # Public pages (landing, pricing, about)
│   ├── (auth)/                   # Better Auth pages (connexion, inscription, mot-de-passe-oublie, reinitialiser-mot-de-passe)
│   ├── (dashboard)/              # Student dashboard (protected)
│   ├── (admin)/                  # Admin dashboard (protected)
│   └── api/                      # Route handlers (auth, stripe webhook, cron, e2e)
├── features/                     # Backend per domain: {schemas,dal,actions,lib,cron}.ts
│   ├── users/  payments/  questions/  exams/  training/  analytics/  marketing/
├── db/                           # Drizzle: schema/** (tables, enums) + index.ts (pg Pool)
├── lib/                          # auth, dal, auth-guards, aws, storage, stripe, cdn, ids, env
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── shared/                   # Shared components (sidebar, nav, payments)
│   ├── quiz/                     # Quiz: question-card, calculator, session
│   ├── admin/                    # Admin: dashboard, charts, activity-feed
│   ├── marketing/                # Marketing page components
│   └── seo/                      # SEO components (JSON-LD)
├── email/                        # AWS SES client + React Email templates
├── tests/                        # Frontend (happy-dom) + integration (Neon branch)
├── e2e/                          # Playwright tests + POMs
├── schemas/                      # Zod validation schemas
├── hooks/                        # Custom React hooks
└── constants/                    # Constants (navigation, routes, domains)
```

## 🎨 Available Scripts

```bash
bun dev                  # Start dev server with Turbopack
bun run env:sync         # Pull & regroup .env.local from Vercel (development scope)
bun run build            # Production build
bun run check            # Type check + lint (before commit)
bun run lint:fix         # Automatically fix lint errors
bun run test             # Run frontend tests
bun run test:coverage    # Run tests with coverage report
bun run test:integration # DAL/Actions tests on an ephemeral Neon branch
bun run test:e2e         # Playwright E2E tests
bun run db:generate      # Generate a migration from the schema
bun run db:migrate       # Apply migrations
```

## 🏗️ Architecture

### Route Groups

The project uses Next.js route groups to organize the application:

- **(marketing)** - Public marketing pages (landing, pricing, about)
- **(auth)** - Authentication (connexion, inscription, mot-de-passe-oublie, reinitialiser-mot-de-passe)
- **(dashboard)** - Student space with sidebar
- **(admin)** - Administrator space with sidebar

### Backend (Drizzle + Server Actions)

- **Neon Postgres** accessed via **Drizzle ORM** (a single `pg` Pool at module scope — Vercel Fluid Compute)
- **Data Access Layer** (`features/<domain>/dal.ts`): `server-only` reads, React `cache()`, targeted columns, keyset pagination
- **Server Actions** (`features/<domain>/actions.ts`): writes guarded by auth + Zod, `revalidatePath`, row-locking for per-user concurrency
- **Route handlers** (`app/api/**`): Stripe webhook, hourly cron (close expired exams/training), E2E support
- **Cron** hitting `app/api/cron/close-expired`: `vercel.json` daily (Hobby plan floor) + a GitHub Actions workflow (`cron-hourly.yml`) that calls it hourly

### Authentication

- **Better Auth** (`lib/auth.ts`, route `app/api/auth/[...all]`) — email/password + Google OAuth, admin plugin for roles
- **Route protection**: `proxy.ts` does an optimistic cookie check; the real guard is server-side in the `(dashboard)`/`(admin)` layouts (`requireSession` / `requireRole`)
- **Roles**: `user` (student) and `admin` (administrator)

### Payments

- **Stripe** Checkout Sessions + signed webhooks (idempotent fulfillment)
- **Manual payments** for admin-managed transactions
- **Access types**: `exam` (mock exams) and `training` (question bank), time-based via the `user_access` table with `expiresAt`
- Admins bypass access checks automatically

### Media

- **AWS S3 + CloudFront** for file storage & delivery (`lib/storage.ts` + `lib/aws.ts`); uploads via presigned POST (direct browser→S3), reads via CloudFront (private bucket + OAC)
- Avatar uploads (rate limited: 5/hour) + question images (admin only, 50/hour)
- Uploads via Server Actions; display URLs derived from the storage path (`lib/cdn.ts`)

## 🔐 Security

- Server-side session/role verification in guards (`lib/auth-guards.ts`) + each sensitive DAL/Action (defense in depth)
- Standardized result shapes; row-locking (`.for("update")`) or guarded UPDATEs for concurrency
- Rate limiting on uploads (`lib/upload-rate-limit.ts`)
- Webhook signature validation (Stripe); cron/E2E routes guarded by shared secret (fail-closed)
- Data validation with Zod (client + server); env validated with Zod (`lib/env/schema.ts`)

## 🧪 Testing

- **Framework**: Vitest with coverage threshold at 75%
- **Frontend tests**: `tests/` directory, using happy-dom + @testing-library/react
- **Integration tests**: `tests/integration/` (Node) run against an ephemeral Neon branch via `bun run test:integration`
- **E2E**: Playwright (`e2e/`) with Better Auth sign-in + POMs
- **CI**: GitHub Actions runs type check, lint, and tests with coverage on every push/PR

## 🌍 Deployment

### Vercel (recommended for Next.js)

1. Connect your GitHub repo to Vercel
2. Add environment variables (see `.env.example`)
3. Add the Neon integration (or set `DATABASE_URL` / `DATABASE_URL_UNPOOLED`)
4. Deploy. The hourly job runs via GitHub Actions (`cron-hourly.yml`); set the `CRON_SECRET` repo secret + `CRON_ENDPOINT_URL` repo variable. `vercel.json` keeps a daily fallback that works on the free Hobby plan.

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the project
2. Create a branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Coding Conventions

- ✅ Use **arrow functions** for all functions
- ✅ Organize page components in `_components` folders
- ✅ French text for the entire interface (with proper accents)
- ✅ Run `bun run check` before committing
- ✅ Handle loading states with custom skeletons
- ✅ Skip auth-dependent data with `"skip"` patterns until the session is ready

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 👥 Author

**Samuel Pokam (RinKhimera)**

- GitHub: [@RinKhimera](https://github.com/RinKhimera)

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React Framework
- [Neon](https://neon.tech/) + [Drizzle ORM](https://orm.drizzle.team/) - Database
- [Better Auth](https://better-auth.com/) - Authentication
- [Stripe](https://stripe.com/) - Payment Processing
- [shadcn/ui](https://ui.shadcn.com/) - UI Components
- [Tailwind CSS](https://tailwindcss.com/) - CSS Framework
- [AWS S3 + CloudFront](https://aws.amazon.com/s3/) - Media Storage
- [Sentry](https://sentry.io/) - Error Monitoring

---

<div align="center">
Made with ❤️ for medical students
</div>
