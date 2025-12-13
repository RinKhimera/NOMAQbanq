# NOMAQbanq

> The first French-language platform for EACMC Part I exam preparation

NOMAQbanq is a modern medical exam preparation web application, offering a comprehensive question bank, timed mock exams, and a personalized progress tracking system.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Convex](https://img.shields.io/badge/Convex-Backend-orange)](https://convex.dev/)
[![Clerk](https://img.shields.io/badge/Clerk-Auth-purple)](https://clerk.com/)

## ✨ Features

### For Students

- 📚 **Question Bank** - Over 5000 MCQs organized by medical domain
- ⏱️ **Mock Exams** - Exam simulations with timer and real conditions
- 📊 **Progress Tracking** - Detailed statistics of your performance
- 🎯 **Targeted Learning** - Training by domain (Cardiology, Neurology, etc.)
- 💡 **Detailed Explanations** - Complete corrections with references

### For Administrators

- ➕ **Question Management** - Creation, editing and bulk import
- 📝 **Exam Creation** - Configure exams with dates and participants
- 👥 **User Management** - Administration of access and roles
- 📈 **Dashboard** - Statistics and activity overview

## 🚀 Tech Stack

- **Framework** - [Next.js 15](https://nextjs.org/) with App Router
- **Language** - [TypeScript](https://www.typescriptlang.org/)
- **UI** - [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Backend** - [Convex](https://convex.dev/) (Real-time BaaS)
- **Authentication** - [Clerk](https://clerk.com/) (with webhooks)
- **Forms** - [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **Icons** - [Lucide](https://lucide.dev/) + [Tabler Icons](https://tabler.io/icons)

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **Convex Account** - [Create an account](https://convex.dev/)
- **Clerk Account** - [Create an account](https://clerk.com/)

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

Create a `.env.local` file at the root of the project:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_FRONTEND_API_URL=clerk.your-domain.com
CLERK_WEBHOOK_SECRET=whsec_...

# Convex Backend
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOYMENT=prod:your-deployment
```

4. **Configure Convex**

```bash
npx convex dev
```

5. **Configure Clerk webhook**
   - In your Clerk dashboard, create a webhook pointing to `https://your-convex-url/clerk`
   - Enable events: `user.created`, `user.updated`, `user.deleted`
   - Copy the webhook secret to `CLERK_WEBHOOK_SECRET`

6. **Launch the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
NOMAqBANK/
├── app/                      # Next.js Pages (App Router)
│   ├── (marketing)/         # Public pages (landing, about, etc.)
│   ├── (auth)/              # Authentication pages
│   ├── (dashboard)/         # Student dashboard (protected)
│   ├── (admin)/             # Admin dashboard (protected)
│   └── layout.tsx           # Root layout
├── components/              # Reusable React components
│   ├── ui/                  # shadcn/ui components
│   ├── shared/              # Shared components (sidebar, nav)
│   └── admin/               # Admin-specific components
├── convex/                  # Convex Backend
│   ├── schema.ts            # Database schema
│   ├── users.ts             # User functions
│   ├── questions.ts         # Question functions
│   ├── exams.ts             # Exam functions
│   └── http.ts              # Webhooks (Clerk)
├── schemas/                 # Zod validation schemas
├── hooks/                   # Custom React hooks
├── constants/               # Constants (navigation, domains)
├── data/                    # Static data
└── lib/                     # Utilities
```

## 🎨 Available Scripts

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Lint code
npm run type-check   # Check TypeScript types
npm run build-check  # Type check + lint (before commit)
npm run fix-lint     # Automatically fix lint errors
```

## 🏗️ Architecture

### Route Groups

The project uses Next.js route groups to organize the application:

- **(marketing)** - Public marketing pages
- **(auth)** - Authentication (sign-in, sign-up)
- **(dashboard)** - Student space with sidebar
- **(admin)** - Administrator space with sidebar

### Convex Backend

Convex handles all backend logic:

- Real-time database
- Serverless functions (queries, mutations)
- Webhooks for Clerk synchronization
- Integrated authentication

### Authentication

- **Clerk** handles user authentication
- **Webhooks** synchronize users with Convex
- **Middleware** protects `/dashboard` and `/admin` routes
- **Roles**: `user` (student) and `admin` (administrator)

## 🔐 Security

- Routes protected by Next.js middleware
- Server-side role verification (Convex)
- Internal mutations for webhooks
- Data validation with Zod

## 🌍 Deployment

### Vercel (recommended for Next.js)

1. Connect your GitHub repo to Vercel
2. Add environment variables
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
- ✅ Always use the `useCurrentUser` hook to access user data
- ✅ Handle loading states with loaders
- ✅ French text for the entire interface

See [.github/copilot-instructions.md](.github/copilot-instructions.md) for more details.

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 👥 Author

**Samuel Pokam (RinKhimera)**

- GitHub: [@RinKhimera](https://github.com/RinKhimera)

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React Framework
- [Convex](https://convex.dev/) - Real-time Backend
- [Clerk](https://clerk.com/) - Authentication
- [shadcn/ui](https://ui.shadcn.com/) - UI Components
- [Tailwind CSS](https://tailwindcss.com/) - CSS Framework

---

<div align="center">
Made with ❤️ for medical students
</div>
