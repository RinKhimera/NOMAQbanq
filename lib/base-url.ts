// Server-only. NE PAS importer depuis un composant 'use client'.
import { env } from "@/lib/env/server"

const stripTrailingSlash = (url: string): string => url.replace(/\/$/, "")

/**
 * URL d'origine de l'app, sans slash final. Sert de `baseURL` à Better Auth
 * (redirections OAuth, cookies, origines de confiance, base des liens dans les
 * emails) et à reconstruire les URLs de retour Stripe. Ordre de priorité :
 *
 *  1. `BETTER_AUTH_URL` explicite — override (dev local → http://localhost:3000,
 *     ou pin manuel d'un domaine précis).
 *  2. Production Vercel (`VERCEL_ENV=production`) → `VERCEL_PROJECT_PRODUCTION_URL`
 *     (domaine custom de prod si configuré, sinon `*.vercel.app`).
 *  3. Preview Vercel → `VERCEL_BRANCH_URL` (URL stable par branche), à défaut
 *     `VERCEL_URL` (URL unique du déploiement).
 *  4. Défaut local → http://localhost:3000.
 *
 * Les variables `VERCEL_*` sont injectées par Vercel (absentes en local) et ne
 * portent pas le protocole — on préfixe `https://`.
 */
export function getBaseUrl(): string {
  if (env.BETTER_AUTH_URL) return stripTrailingSlash(env.BETTER_AUTH_URL)

  if (
    process.env.VERCEL_ENV === "production" &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  ) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  const previewHost = process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL
  if (previewHost) return `https://${previewHost}`

  return "http://localhost:3000"
}
