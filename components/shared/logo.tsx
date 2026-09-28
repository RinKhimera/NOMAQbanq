import Image from "next/image"
import { cn } from "@/lib/utils"

type LogoProps = {
  /** Libellé mono sous le nom (« Préparation EACMC », « Administration »). */
  tagline?: string
  admin?: boolean
  className?: string
}

/**
 * Logotype : marque « N » et « NOMAQbanq ». Les deux marques sont rendues et
 * la classe `.dark` choisit : aucun état de thème lu au rendu, donc rien à
 * réconcilier à l'hydratation.
 */
export const Logo = ({ tagline, admin = false, className }: LogoProps) => (
  <span className={cn("inline-flex items-center gap-2.5", className)}>
    <Image
      src="/icons/concept_4_abstract_n.svg"
      alt=""
      width={26}
      height={26}
      className="dark:hidden"
    />
    <Image
      src="/icons/logo-mark-dark.svg"
      alt=""
      width={26}
      height={26}
      className="hidden dark:block"
    />
    <span className="flex flex-col gap-0.75">
      <span className="text-ink text-[15px] leading-none font-semibold tracking-[-0.01em]">
        NOMAQ<span className="text-accent-ink">banq</span>
      </span>
      {tagline && (
        <span
          className={cn(
            "font-mono text-[10px] leading-none font-medium tracking-[0.06em] uppercase",
            admin ? "text-admin-ink" : "text-ink-3",
          )}
        >
          {tagline}
        </span>
      )}
    </span>
  </span>
)
