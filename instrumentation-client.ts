// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from "@sentry/nextjs"
import { isThirdPartyRsCrash } from "@/lib/sentry-filters"

Sentry.init({
  dsn: "https://c7c726531f3e9dc07a6488f3bd7ae9b4@o4510410010787842.ingest.us.sentry.io/4510410016227333",

  // Dev local et e2e (y compris le build prod du chemin CI, via le kill-switch)
  // ne doivent jamais polluer le projet Sentry de prod.
  enabled:
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_SENTRY_DISABLED !== "1",
  // VERCEL_ENV n'existe pas dans le bundle navigateur ; fallback "production"
  // (et pas "development") : `enabled` garantit déjà qu'on est en build prod.
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "production",

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.15 : 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Mode buffer pur : aucune session enregistree tant qu'aucune erreur ne
  // survient. Le plan Developer plafonne a 50 replays/mois ; un taux de session
  // non nul epuise ce quota en quelques jours de trafic normal, apres quoi
  // Sentry rejette AUSSI les replays des vraies erreurs — exactement ceux dont
  // on a besoin. Les taux indexes sur le trafic recommandes par la doc Sentry
  // (0.25 sous 10 000 sessions/jour) supposent un plan payant.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  beforeSend(event, hint) {
    return isThirdPartyRsCrash(event, hint) ? null : event
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
