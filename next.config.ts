import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@tabler/icons-react", "lucide-react", "recharts"],
    // NB : plus de `serverActions.bodySizeLimit` — les uploads passent en
    // presigned POST direct vers S3 (le fichier ne transite plus par les Server
    // Actions). Retour au défaut, ce qui clôt la dette F1 (les actions publiques
    // `loadRandomQuizQuestions`/`scoreQuizAnswers` n'acceptent plus 6 Mo de corps).
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "images.clerk.dev",
      },
      {
        // Domaine par défaut de la distribution CloudFront — utile pour tester en
        // preview avant la bascule DNS (NEXT_PUBLIC_CDN_HOSTNAME=dxxxx.cloudfront.net).
        protocol: "https",
        hostname: "*.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "cdn.nomaqbanq.ca",
      },
      {
        // Avatars OAuth Google (user.image = URL lh3.googleusercontent.com).
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  // Redirections permanentes (308) des anciennes URL EN vers les nouvelles URL FR.
  // La query (?token=, ?session_id=) est transmise automatiquement. Ordre = priorité
  // de match (spécifiques avant wildcards).
  async redirects() {
    return [
      // — Étudiant —
      {
        source: "/dashboard/entrainement/:sessionId/results",
        destination: "/tableau-de-bord/entrainement/:sessionId/resultats",
        permanent: true,
      },
      {
        source: "/dashboard/onboarding",
        destination: "/tableau-de-bord/bienvenue",
        permanent: true,
      },
      {
        source: "/dashboard/payment/success",
        destination: "/tableau-de-bord/paiement/succes",
        permanent: true,
      },
      {
        source: "/dashboard/:path*",
        destination: "/tableau-de-bord/:path*",
        permanent: true,
      },
      {
        source: "/dashboard",
        destination: "/tableau-de-bord",
        permanent: true,
      },
      // — Admin —
      {
        source: "/admin/exams/create",
        destination: "/admin/examens/creer",
        permanent: true,
      },
      {
        source: "/admin/exams/edit/:id",
        destination: "/admin/examens/modifier/:id",
        permanent: true,
      },
      {
        source: "/admin/exams/:id/results/:userId",
        destination: "/admin/examens/:id/resultats/:userId",
        permanent: true,
      },
      {
        source: "/admin/exams/:id",
        destination: "/admin/examens/:id",
        permanent: true,
      },
      {
        source: "/admin/exams",
        destination: "/admin/examens",
        permanent: true,
      },
      {
        source: "/admin/users/:path*",
        destination: "/admin/utilisateurs/:path*",
        permanent: true,
      },
      {
        source: "/admin/users",
        destination: "/admin/utilisateurs",
        permanent: true,
      },
      // — Auth —
      { source: "/auth/sign-in", destination: "/connexion", permanent: true },
      {
        source: "/auth/sign-up",
        destination: "/inscription",
        permanent: true,
      },
      {
        source: "/auth/forgot-password",
        destination: "/mot-de-passe-oublie",
        permanent: true,
      },
      {
        source: "/auth/reset-password",
        destination: "/reinitialiser-mot-de-passe",
        permanent: true,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "khimera-9h",

  project: "nomaqbanq",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Webpack-specific options (only apply to production builds, not Turbopack)
  webpack: {
    // Automatically tree-shake Sentry logger statements to reduce bundle size
    treeshake: {
      removeDebugLogging: true,
    },
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
  },
})
