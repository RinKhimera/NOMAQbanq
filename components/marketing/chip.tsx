import { cn } from "@/lib/utils"

/**
 * Pastille de la vitrine (filtre, lien vers un domaine, document légal) :
 * 32 px, 44 px sous 768 px. L'état actif se lit par `aria-pressed` ou
 * `aria-current` côté appelant ; `active` n'en porte que le style.
 */
export const chipClass = (active = false) =>
  cn(
    "focus-ring inline-flex h-8 max-w-full cursor-pointer items-center gap-2 rounded-md border px-3 text-sm whitespace-nowrap transition-[background-color,border-color] duration-(--duration-fast) max-md:h-11",
    active
      ? "border-accent bg-accent-soft text-accent-ink"
      : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
  )
