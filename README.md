# NOMAQbanq

> The first French-language platform for EACMC Part I exam preparation

NOMAQbanq is a modern medical exam preparation web application, offering a comprehensive question bank, timed mock exams, and a personalized progress tracking system.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Convex](https://img.shields.io/badge/Convex-Backend-orange)](https://convex.dev/)
[![Clerk](https://img.shields.io/badge/Clerk-Auth-purple)](https://clerk.com/)
[![CI](https://github.com/RinKhimera/NOMAQbanq/actions/workflows/ci.yml/badge.svg)](https://github.com/RinKhimera/NOMAQbanq/actions/workflows/ci.yml)

## ✨ Features

### For Students

- 📚 **Question Bank** - Over 5000 MCQs organized by medical domain
- ⏱️ **Mock Exams** - Exam simulations with timer, pause system, and real conditions
- 📊 **Progress Tracking** - Detailed statistics, score history, and leaderboard
- 🎯 **Targeted Training** - Training by domain (Cardiology, Neurology, etc.)
- 💡 **Detailed Explanations** - Complete corrections with references
- 🧮 **Built-in Calculator** - Scientific calculator available during exams

### For Administrators

- ➕ **Question Management** - Creation, editing and bulk import (XLSX)
- 📝 **Exam Creation** - Configure exams with dates, timer, and pause settings
- 👥 **User Management** - Administration of access, roles, and payments
- 📈 **Dashboard** - Real-time statistics, trends, activity feed, and revenue tracking
- 💳 **Payment Management** - Manual payments and Stripe integration

## 🚀 Tech Stack

| Category       | Technologies                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**  | [Next.js 16](https://nextjs.org/) (App Router, Turbopack)                                                                        |
| **Language**   | [TypeScript](https://www.typescriptlang.org/)                                                                                    |
| **UI**         | [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)                                                |
| **Backend**    | [Convex](https://convex.dev/) (Real-time BaaS)                                                                                   |
| **Auth**       | [Clerk](https://clerk.com/) (webhooks + roles)                                                                                   |
| **Payments**   | [Stripe](https://stripe.com/) (webhooks)                                                                                         |
| **Media**      | [Bunny CDN](https://bunny.net/) (avatars, question images)                                                                       |
| **Monitoring** | [Sentry](https://sentry.io/) (error tracking)                                                                                    |
| **Animations** | [motion](https://motion.dev/)                                                                                                    |
| **Charts**     | [Recharts](https://recharts.org/)                                                                                                |
| **Forms**      | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)                                                        |
| **Icons**      | [Tabler Icons](https://tabler.io/icons) (primary) + [Lucide](https://lucide.dev/) (secondary)                                    |
| **Testing**    | [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) + [convex-test](https://docs.convex.dev/testing) |

## 📋 Prerequisites

- **Node.js** 20+ and npm
- **Convex Account** - [Create an account](https://convex.dev/)
- **Clerk Account** - [Create an account](https://clerk.com/)
- **Stripe Account** - [Create an account](https://stripe.com/) (for payments)

## 🛠️ Installation

1. **Clone the project**

```bash
git clone https://github.com/RinKhimera/NOMAQbanq.git
cd NOMAQbanq
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Copy the example file and fill in your keys:

```bash
cp .env.example .env.local
```

See [`.env.example`](.env.example) for all required variables (Convex, Clerk, Stripe, Bunny CDN, Sentry).

4. **Configure Convex**

```bash
npx convex dev
```

5. **Configure Clerk webhook**
   - In your Clerk dashboard, create a webhook pointing to `https://your-convex-url/clerk`
   - Enable events: `user.created`, `user.updated`, `user.deleted`
   - Copy the webhook secret to `CLERK_WEBHOOK_SECRET`

6. **Configure Stripe webhook** (optional, for payments)
   - In your Stripe dashboard, create a webhook pointing to `https://your-convex-url/stripe`
   - Copy the webhook secret to `STRIPE_WEBHOOK_SECRET`

7. **Launch the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
NOMAQbanq/
├── app/                          # Next.js Pages (App Router)
│   ├── (marketing)/              # Public pages (landing, pricing, about)
│   ├── (auth)/                   # Authentication pages
│   ├── (dashboard)/              # Student dashboard (protected)
│   └── (admin)/                  # Admin dashboard (protected)
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── shared/                   # Shared components (sidebar, nav, payments)
│   ├── quiz/                     # Quiz: question-card, calculator, session
│   ├── admin/                    # Admin: dashboard, charts, activity-feed
│   ├── marketing/                # Marketing page components
│   └── seo/                      # SEO components (JSON-LD)
├── convex/                       # Convex Backend
│   ├── schema.ts                 # Database schema
│   ├── users.ts                  # User CRUD + admin filters
│   ├── questions.ts              # Question CRUD + bulk import
│   ├── exams.ts                  # Exam CRUD + start/submit
│   ├── examStats.ts              # Stats, leaderboard, score history
│   ├── examPause.ts              # Pause state machine
│   ├── training.ts               # Training sessions
│   ├── payments.ts               # Payment tracking + revenue
│   ├── stripe.ts                 # Stripe checkout + webhooks
│   ├── analytics.ts              # Admin dashboard trends
│   ├── crons.ts                  # Scheduled jobs
│   ├── http.ts                   # HTTP actions (webhooks, uploads)
│   └── lib/                      # Helpers: auth, errors, batchFetch, bunny
├── tests/                        # Test suites
│   ├── convex/                   # Convex backend tests (edge-runtime)
│   └── ...                       # Frontend tests (happy-dom)
├── schemas/                      # Zod validation schemas
├── hooks/                        # Custom React hooks
├── providers/                    # React providers (Convex, Clerk, Theme)
├── constants/                    # Constants (navigation, routes, domains)
├── data/                         # Static data (marketing pages)
└── lib/                          # Utilities
```

## 🎨 Available Scripts

```bash
npm run dev              # Start dev server with Turbopack
npm run build            # Production build
npm run build-check      # Type check + lint (before commit)
npm run test             # Run tests
npm run test:all         # Run all tests
npm run test:coverage    # Run tests with coverage report
npm run test:ui          # Run tests with Vitest UI
npm run fix-lint         # Automatically fix lint errors
```

## 🏗️ Architecture

### Route Groups

The project uses Next.js route groups to organize the application:

- **(marketing)** - Public marketing pages (landing, pricing, about)
- **(auth)** - Authentication (sign-in, sign-up)
- **(dashboard)** - Student space with sidebar
- **(admin)** - Administrator space with sidebar

### Convex Backend

Convex handles all backend logic:

- Real-time database with reactive queries
- Serverless functions (queries, mutations, actions)
- HTTP actions for webhooks (Clerk, Stripe) and file uploads
- Integrated authentication via Clerk
- Cron jobs for automated cleanup (expired exams, training sessions)

### Authentication

- **Clerk** handles user authentication
- **Webhooks** synchronize users with Convex database
- **Route protection** via `proxy.ts` for `/dashboard` and `/admin` routes
- **Server-side role verification** in every Convex function
- **Roles**: `user` (student) and `admin` (administrator)

### Payments

- **Stripe** for online payments with checkout sessions
- **Manual payments** for admin-managed transactions
- **Access types**: `exam` (mock exams) and `training` (question bank)
- **Time-based access** via `userAccess` table with `expiresAt`
- Admins bypass access checks automatically

### Media

- **Bunny CDN** for file storage and delivery
- Avatar uploads (rate limited: 5/hour)
- Question images (admin only)
- Upload endpoints via Convex HTTP actions

## 🔐 Security

- Route protection via proxy middleware
- Server-side role verification in every Convex function (`getCurrentUserOrThrow`, `getAdminUserOrThrow`)
- Standardized error handling (`convex/lib/errors.ts`)
- Rate limiting on uploads (`convex/rateLimit.ts`)
- CORS headers on all HTTP actions
- Webhook signature validation (Clerk, Stripe)
- Data validation with Zod on client, Convex validators on server

## 🧪 Testing

- **Framework**: Vitest with coverage threshold at 75%
- **Frontend tests**: `tests/` directory, using happy-dom + @testing-library/react
- **Backend tests**: `tests/convex/` directory, using edge-runtime + convex-test
- **CI**: GitHub Actions runs type check, lint, and tests with coverage on every push/PR

## 🌍 Deployment

### Vercel (recommended for Next.js)

1. Connect your GitHub repo to Vercel
2. Add environment variables (see `.env.example`)
3. Deploy!

### Convex

```bash
npx convex deploy
```

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
- ✅ Run `npm run build-check` before committing
- ✅ Handle loading states with custom skeletons
- ✅ Use `useConvexAuth` + `"skip"` for auth-dependent queries

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 👥 Author

**Samuel Pokam (RinKhimera)**

- GitHub: [@RinKhimera](https://github.com/RinKhimera)

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React Framework
- [Convex](https://convex.dev/) - Real-time Backend
- [Clerk](https://clerk.com/) - Authentication
- [Stripe](https://stripe.com/) - Payment Processing
- [shadcn/ui](https://ui.shadcn.com/) - UI Components
- [Tailwind CSS](https://tailwindcss.com/) - CSS Framework
- [Bunny CDN](https://bunny.net/) - Media Storage
- [Sentry](https://sentry.io/) - Error Monitoring

---

<div align="center">
Made with ❤️ for medical students
</div>
