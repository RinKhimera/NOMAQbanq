import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PageIntroProps = {
  title: ReactNode
  /** Libellé mono au-dessus du titre (« Compte », date du jour). */
  eyebrow?: ReactNode
  description?: ReactNode
  backHref?: string
  /** Passent sous le texte, en pleine largeur, sous 768 px. */
  actions?: ReactNode
  className?: string
}

/** En-tête unique des pages de l'app : un seul `h1` par page. */
export const PageIntro = ({
  title,
  eyebrow,
  description,
  backHref,
  actions,
  className,
}: PageIntroProps) => (
  <div
    className={cn(
      "flex flex-wrap items-end justify-between gap-4 pb-1",
      className,
    )}
  >
    <div className="flex min-w-0 items-start gap-3">
      {backHref && (
        <Button
          asChild
          variant="outline"
          size="icon"
          className="mt-1 shrink-0 max-md:size-11"
        >
          <Link href={backHref} aria-label="Retour">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
      )}
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow && <p className="type-label">{eyebrow}</p>}
        <h1 className="type-h2 text-ink">{title}</h1>
        {description && (
          <p className="text-ink-2 max-w-2xl text-[0.9375rem] leading-[1.55]">
            {description}
          </p>
        )}
      </div>
    </div>

    {actions && (
      <div className="flex flex-wrap items-center gap-3 max-md:w-full max-md:*:flex-1">
        {actions}
      </div>
    )}
  </div>
)
