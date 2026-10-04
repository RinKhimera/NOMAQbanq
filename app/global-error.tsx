"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

// Remplace le layout racine : ni `globals.css` ni ses utilitaires Tailwind ne
// sont chargés ici. La page porte donc ses propres styles, valeurs de DESIGN.md §2.
const STYLES = `
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: #fbfbfa; color: #0f172a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .ge { max-width: 32rem; padding: 1.5rem; text-align: center; }
  .ge h1 { margin: 0 0 0.5rem; font-family: Georgia, "Times New Roman", serif;
    font-size: 1.5rem; font-weight: 600; }
  .ge p { margin: 0 0 1.5rem; color: #3f4a5c; line-height: 1.6; }
  .ge button { height: 40px; padding: 0 1rem; border: 0; border-radius: 4px;
    background: #2563eb; color: #fff; font: inherit; font-weight: 500; cursor: pointer; }
  .ge button:hover { background: #1d4ed8; }
  .ge button:focus-visible { outline: none; box-shadow: 0 0 0 3px rgb(37 99 235 / 0.4); }
  @media (prefers-color-scheme: dark) {
    body { background: #0a1122; color: #e6ebf5; }
    .ge p { color: #b4bfd4; }
  }
`

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="fr">
      <head>
        <style>{STYLES}</style>
      </head>
      <body>
        <div className="ge">
          <h1>Une erreur est survenue</h1>
          <p>Nous nous excusons pour le désagrément. Veuillez réessayer.</p>
          <button type="button" onClick={reset}>
            Réessayer
          </button>
        </div>
      </body>
    </html>
  )
}
