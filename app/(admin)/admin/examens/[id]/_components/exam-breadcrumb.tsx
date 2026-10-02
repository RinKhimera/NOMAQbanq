import Link from "next/link"
import { Fragment } from "react"

type Crumb = { label: string; href?: string }

/** Fil d'Ariane des écrans d'un examen : « Examens blancs › … ». */
export const ExamBreadcrumb = ({ items }: { items: Crumb[] }) => (
  <nav aria-label="Fil d'Ariane" className="text-ink-3 text-sm">
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {[{ label: "Examens blancs", href: "/admin/examens" }, ...items].map(
        (crumb, index, all) => (
          <Fragment key={`${index}-${crumb.label}`}>
            {index > 0 && <li aria-hidden>›</li>}
            <li className="min-w-0 wrap-anywhere">
              {crumb.href && index < all.length - 1 ? (
                <Link href={crumb.href} className="hover:text-ink">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-ink">
                  {crumb.label}
                </span>
              )}
            </li>
          </Fragment>
        ),
      )}
    </ol>
  </nav>
)
