"use client"

import * as Sentry from "@sentry/nextjs"
import type { LucideIcon } from "lucide-react"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ErrorState } from "./error-state"

type RouteErrorLink = { label: string; href: string; icon?: LucideIcon }

type RouteErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
  title: string
  description?: string
  icon?: LucideIcon
  links?: RouteErrorLink[]
  footnote?: string
}

/** Rendu commun des `error.tsx` : signalement Sentry, réessai, sorties. */
export const RouteError = ({
  error,
  reset,
  links = [],
  ...props
}: RouteErrorProps) => {
  useEffect(() => {
    // Doublon SSR voulu : crash serveur = event onRequestError (vraie stack)
    // + cet event digest ; crash client = cet event seul. Ne pas retirer.
    Sentry.captureException(error)
  }, [error])

  // Rechargement complet volontaire : depuis une error boundary, l'arbre React
  // est dans un état d'erreur et une navigation client ne le remonte pas.
  const leaveTo = (href: string) => window.location.assign(href)

  return (
    <ErrorState
      {...props}
      variant="page"
      onRetry={reset}
      details={
        process.env.NODE_ENV === "development" && (
          <div className="rounded-lg bg-gray-100 p-3 text-left dark:bg-gray-800">
            <p className="font-mono text-xs text-gray-700 dark:text-gray-300">
              <strong>Erreur:</strong> {error.message}
            </p>
            {error.digest && (
              <p className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">
                <strong>ID:</strong> {error.digest}
              </p>
            )}
          </div>
        )
      }
      actions={links.map(({ label, href, icon: LinkIcon }) => (
        <Button
          key={href}
          type="button"
          variant="outline"
          onClick={() => leaveTo(href)}
          className="gap-2"
        >
          {LinkIcon && <LinkIcon className="h-4 w-4" />}
          {label}
        </Button>
      ))}
    />
  )
}
