import Link from "next/link"
import { Logo } from "@/components/shared/logo"
import { FOOTER_LEGAL_LINKS, FOOTER_QUICK_LINKS } from "@/constants"
import { getAppZoneYear } from "@/lib/app-zone"
import { cn } from "@/lib/utils"

// Au scope du module : pas d'horloge dans le rendu (`react-hooks/purity`).
// Année du fuseau de la plateforme, pas de celui du runtime (UTC en prod).
const CURRENT_YEAR = getAppZoneYear(Date.now())

// Cible tactile de 44 px sous 768 px.
const linkClass =
  "focus-ring text-ink-2 hover:text-ink inline-flex w-fit items-center rounded-md text-sm transition-[background-color,border-color] duration-(--duration-base) max-md:min-h-11"

const columnLabel =
  "text-ink-3 font-mono text-xs font-medium tracking-[0.06em] uppercase"

export default function Footer() {
  return (
    <footer className="border-line border-t">
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-8 sm:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[2fr_1fr_1.4fr] md:gap-12">
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="focus-ring flex w-fit items-center rounded-md max-md:min-h-11"
            >
              <Logo />
            </Link>
            <p className="text-ink-3 max-w-90 text-sm leading-relaxed">
              La première plateforme francophone de préparation à l&apos;EACMC
              Partie&nbsp;I.
            </p>
          </div>

          <nav
            aria-label="Liens du site"
            className="flex flex-col gap-2.5 max-md:gap-0"
          >
            <p className={columnLabel}>Liens</p>
            {FOOTER_QUICK_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass}>
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-2.5 max-md:gap-0">
            <p className={columnLabel}>Contact</p>
            <a href="mailto:nomaqbanq@outlook.com" className={linkClass}>
              nomaqbanq@outlook.com
            </a>
            <a
              href="tel:+14388750746"
              className={cn(linkClass, "font-mono text-[13px]")}
            >
              +1 (438) 875-0746
            </a>
            <p className="text-ink-3 text-sm">
              114 rue Isabelle, Gatineau (Québec) J8Y 5H3
            </p>
          </div>
        </div>

        <div className="border-line text-ink-3 mt-12 flex flex-wrap justify-between gap-3 border-t pt-5 text-[13px]">
          <p>© {CURRENT_YEAR} NOMAQbanq</p>
          <nav
            aria-label="Liens légaux"
            className="flex flex-wrap gap-x-5 max-md:flex-col"
          >
            {FOOTER_LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="focus-ring hover:text-ink inline-flex w-fit items-center rounded-md transition-[background-color,border-color] duration-(--duration-base) max-md:min-h-11"
              >
                {link.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
