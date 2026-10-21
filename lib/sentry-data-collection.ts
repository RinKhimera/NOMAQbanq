import type * as Sentry from "@sentry/nextjs"

type DataCollection = NonNullable<
  NonNullable<Parameters<typeof Sentry.init>[0]>["dataCollection"]
>

// Par défaut, le SDK attache les corps HTTP (Server Actions : réponses aux
// QCM, courriels ; `/api/auth/*`) et les cookies, dont le jeton de session
// Better Auth. `databaseQueryData` ferme d'avance paramètres SQL et lignes
// renvoyées : l'intégration `pg` n'en envoie pas aujourd'hui, l'option est la
// seule garantie si elle s'y met. Partagé par les trois `Sentry.init`.
export const SENTRY_DATA_COLLECTION: DataCollection = {
  databaseQueryData: false,
  httpBodies: [],
  cookies: false,
}
