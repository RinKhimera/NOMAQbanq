import Link from "next/link"
import { Logo } from "@/components/shared/shell/logo"
import { FOOTER_LEGAL_LINKS, FOOTER_QUICK_LINKS } from "@/constants"
import { getAppZoneYear } from "@/lib/app-zone"

// Constante module-level pour éviter new Date() à chaque render (pureté React 19).
// Année ancrée sur le fuseau de la plateforme : `getFullYear()` sur l'heure du
// runtime fait diverger serveur (UTC) et client le 31 décembre au soir.
const CURRENT_YEAR = getAppZoneYear(Date.now())

const linkClass =
  "focus-ring text-ink-2 hover:text-ink w-fit rounded-md text-sm transition-colors duration-(--duration-base)"

const columnLabel =
  "text-ink-3 font-mono text-xs font-medium tracking-[0.06em] uppercase"

export default function Footer() {
  return (
    <footer className="border-line border-t">
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-8 sm:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[2fr_1fr_1.4fr] md:gap-12">
          <div className="flex flex-col gap-2">
            <Link href="/" className="focus-ring flex w-fit rounded-md">
              <Logo />
            </Link>
            <p className="text-ink-3 max-w-90 text-sm leading-relaxed">
              La première plateforme francophone de préparation à l&apos;EACMC
              Partie&nbsp;I.
            </p>
          </div>

          <nav aria-label="Liens du site" className="flex flex-col gap-2.5">
            <p className={columnLabel}>Liens</p>
            {FOOTER_QUICK_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass}>
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-2.5">
            <p className={columnLabel}>Contact</p>
            <a href="mailto:nomaqbanq@outlook.com" className={linkClass}>
              nomaqbanq@outlook.com
            </a>
            <a
              href="tel:+14388750746"
              className={`${linkClass} font-mono text-[13px]`}
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
          <nav aria-label="Liens légaux" className="flex flex-wrap gap-5">
            {FOOTER_LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="focus-ring hover:text-ink rounded-md transition-colors duration-(--duration-base)"
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
