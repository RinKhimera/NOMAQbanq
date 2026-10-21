import type * as Sentry from "@sentry/nextjs"

type DataCollection = NonNullable<
  NonNullable<Parameters<typeof Sentry.init>[0]>["dataCollection"]
>

// Par défaut, le SDK attache les corps HTTP (Server Actions : réponses aux
// QCM, courriels ; `/api/auth/*` : mots de passe) et les cookies, dont il ne
// masque que les noms sensibles connus (`session`, `token`…) : `cookies: false`
// n'en garde aucun. `databaseQueryData` ne couvre que les spans de requête
// (l'intégration `pg` n'y met pas de paramètres aujourd'hui) ; les paramètres
// cités dans un message d'erreur Drizzle passent par `lib/sentry-scrub.ts`.
// `frameContextLines` garde 7 lignes de source autour de chaque frame (5 par
// défaut). Partagé par les trois `Sentry.init`.
export const SENTRY_DATA_COLLECTION: DataCollection = {
  databaseQueryData: false,
  httpBodies: [],
  cookies: false,
  frameContextLines: 7,
}
