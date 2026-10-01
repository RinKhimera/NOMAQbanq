"use client"

import { SlidersHorizontal } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
} from "@/components/ui/sheet"
import { useMediaQuery } from "@/hooks/use-media-query"

type FilterPanelButtonProps = {
  /** Nombre de filtres du panneau actifs, en compteur sur le bouton. */
  activeCount: number
  onReset: () => void
  /** Pied du panneau sous 768 px : « Afficher 39 questions ». */
  resultLabel: string
  children: ReactNode
}

/**
 * Bouton « Filtres » d'une barre de filtres : les filtres secondaires dans un
 * popover, en plein écran sous 768 px. Chaque filtre s'applique dès qu'on le
 * change ; le panneau n'a pas de bouton « Appliquer ».
 */
export function FilterPanelButton({
  activeCount,
  onReset,
  resultLabel,
  children,
}: FilterPanelButtonProps) {
  const isMobile = useMediaQuery("(max-width: 767px)")
  const [open, setOpen] = useState(false)

  const trigger = (
    <Button
      type="button"
      variant="outline"
      data-testid="btn-filter-panel"
      onClick={isMobile ? () => setOpen(true) : undefined}
    >
      <SlidersHorizontal aria-hidden />
      Filtres
      {activeCount > 0 && (
        <span className="bg-accent text-accent-foreground rounded-full px-1.5 font-mono text-[11px] leading-4.5">
          {activeCount}
        </span>
      )}
    </Button>
  )
  const reset = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={activeCount === 0}
      onClick={onReset}
    >
      Réinitialiser
    </Button>
  )

  if (isMobile)
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="flex h-dvh flex-col gap-0 p-0">
            <div className="border-line border-b px-5 py-4">
              <SheetTitle>Filtres</SheetTitle>
              <SheetDescription className="sr-only">
                Chaque filtre s&apos;applique dès qu&apos;on le change.
              </SheetDescription>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {children}
            </div>
            <SheetFooter className="border-line flex-row gap-2 border-t px-5 py-3 sm:space-x-0">
              {reset}
              <Button
                type="button"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                {resultLabel}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </>
    )

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        {children}
        {activeCount > 0 && <div className="pt-3">{reset}</div>}
      </PopoverContent>
    </Popover>
  )
}

/** Un filtre du panneau : libellé mono, contrôle, aide éventuelle. */
export function FilterGroup({
  label,
  htmlFor,
  help,
  children,
}: {
  label: string
  /** Contrôle unique : lie le libellé ; sinon le groupe est nommé par `label`. */
  htmlFor?: string
  help?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      role={htmlFor ? undefined : "group"}
      aria-label={htmlFor ? undefined : label}
      className="flex flex-col gap-2 not-first:pt-4"
    >
      {htmlFor ? (
        <label htmlFor={htmlFor} className="type-label">
          {label}
        </label>
      ) : (
        <span className="type-label">{label}</span>
      )}
      {children}
      {help && (
        <span className="text-ink-3 text-xs leading-normal">{help}</span>
      )}
    </div>
  )
}
