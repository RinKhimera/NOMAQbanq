import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { Stars } from "@/components/marketing/proof-line"
import { Logo } from "@/components/shared/logo"
import ThemeToggle from "@/components/shared/theme-toggle"
import { UserAvatar } from "@/components/shared/user-avatar"
import { MARKETING_CLAIMS } from "@/constants"
import { testimonials } from "@/data/testimonials"
import type { MarketingStats } from "@/features/marketing/dal"

/**
 * Coquille des pages d'authentification : panneau de marque marine sur trame
 * de points (une zone `.dark`, dès 1024 px), formulaire à droite.
 */
export const AuthShell = ({
  stats,
  children,
}: {
  stats: MarketingStats
  children: ReactNode
}) => {
  const [quote] = testimonials
  const figures = [
    {
      value: stats.totalQuestions,
      label: "QCM basés sur les objectifs du CMC",
    },
    { value: stats.successRate, label: "de réussite chez nos candidats" },
    { value: MARKETING_CLAIMS.rating, label: "note moyenne des candidats" },
  ]

  return (
    <div className="bg-background grid min-h-screen lg:grid-cols-2">
      <aside className="dark bg-background bg-dots text-ink sticky top-0 hidden h-screen flex-col justify-between gap-12 px-12 py-10 lg:flex">
        <Link
          href="/"
          className="focus-ring flex w-fit items-center rounded-md"
          aria-label="Accueil NOMAQbanq"
        >
          <Logo />
        </Link>
        <figure className="flex max-w-120 flex-col gap-5">
          <Stars rating={quote.rating} />
          <blockquote className="font-serif text-2xl leading-[1.45] font-medium text-pretty">
            « {quote.content} »
          </blockquote>
          <figcaption className="flex items-center gap-3">
            <UserAvatar
              name={quote.name}
              image={null}
              className="size-9"
              fallbackClassName="bg-surface-2 text-ink-2 text-xs font-medium"
            />
            <div>
              <p className="text-sm font-semibold">{quote.name}</p>
              <p className="text-ink-3 text-[13px]">{quote.role}</p>
            </div>
          </figcaption>
        </figure>
        <dl className="flex flex-wrap gap-8">
          {figures.map((f) => (
            <div key={f.label} className="flex flex-col gap-0.5">
              <dt className="text-ink-3 order-2 text-[13px]">{f.label}</dt>
              <dd className="order-1 font-serif text-2xl font-semibold">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      </aside>

      <div className="bg-dots-fade flex min-h-screen flex-col">
        <div className="relative flex items-center justify-between gap-3 px-6 py-4">
          <Link
            href="/"
            className="focus-ring text-ink-2 hover:text-ink flex items-center gap-1.5 rounded-md text-sm max-md:min-h-11"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Retour au site
          </Link>
          <ThemeToggle />
        </div>
        <main className="relative grid flex-1 place-items-center px-4 pt-6 pb-16 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  )
}
