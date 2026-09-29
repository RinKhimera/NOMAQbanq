import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type SectionNavItem = { id: string; title: string }

type SectionNavProps = {
  items: readonly SectionNavItem[]
  /** Section courante, si l'appelant suit le défilement. */
  active?: string
  /** « 01 », « 02 »… devant chaque titre. */
  numbered?: boolean
  /** Nom du sommaire latéral (≥ 1024 px). */
  label?: string
  /** Nom du sommaire repliable (< 1024 px). */
  mobileLabel?: string
  /** Position collante du sommaire latéral (`top-…`), selon l'en-tête de la page. */
  className?: string
}

const SectionNumber = ({ index }: { index: number }) => (
  <span
    aria-hidden
    className="text-ink-3 w-5 shrink-0 pt-px font-mono text-xs tabular-nums"
  >
    {String(index + 1).padStart(2, "0")}
  </span>
)

/**
 * Sommaire de sections par ancres : colonne collante dès 1024 px, bloc
 * repliable en dessous. Deux éléments frères, à poser dans la grille de la
 * page (colonne du sommaire, puis contenu).
 */
export const SectionNav = ({
  items,
  active,
  numbered = false,
  label = "Sommaire",
  mobileLabel = "Sommaire de la page",
  className,
}: SectionNavProps) => (
  <>
    <nav
      aria-label={label}
      className={cn("sticky hidden flex-col gap-0.5 lg:flex", className)}
    >
      <span className="type-label px-2.5 pb-2">Sommaire</span>
      {items.map((item, i) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          aria-current={active === item.id ? "location" : undefined}
          className={cn(
            "focus-ring flex min-h-9 items-start gap-2 rounded-md px-2.5 py-1.5 text-sm transition-[background-color] duration-(--duration-fast)",
            active === item.id
              ? "bg-surface-2 text-ink font-medium"
              : "text-ink-2 hover:bg-surface-2",
          )}
        >
          {numbered && <SectionNumber index={i} />}
          <span>{item.title}</span>
        </a>
      ))}
    </nav>

    <details className="group border-line bg-surface rounded-lg border lg:hidden">
      <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 [&::-webkit-details-marker]:hidden">
        <span className="type-label">Sommaire</span>
        <ChevronDown
          aria-hidden
          className="text-ink-3 size-4 group-open:rotate-180"
        />
      </summary>
      <nav aria-label={mobileLabel} className="px-2 pb-2">
        <ol className="flex flex-col">
          {items.map((item, i) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="focus-ring hover:bg-surface-2 text-ink-2 flex min-h-11 items-center gap-2 rounded-md px-2.5 text-sm transition-[background-color] duration-(--duration-fast)"
              >
                {numbered && <SectionNumber index={i} />}
                {item.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  </>
)
