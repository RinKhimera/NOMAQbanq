"use client"

import { type ReactNode, useState } from "react"
import { SearchInput } from "@/components/shared/search-input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { LAB_VALUES_DATA } from "./lab-values-data"
import type { UnitSystem } from "./types"

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()

type LabValuesProps = {
  /** Bouton d'ouverture : il reçoit le focus à la fermeture. */
  trigger: ReactNode
}

/** Valeurs de référence de laboratoire, en Sheet, avec recherche. */
export const LabValues = ({ trigger }: LabValuesProps) => {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("si")
  const [query, setQuery] = useState("")

  const needle = normalize(query.trim())
  const categories = LAB_VALUES_DATA.map((category) => ({
    ...category,
    values: needle
      ? category.values.filter((v) => normalize(v.name).includes(needle))
      : category.values,
  })).filter((category) => category.values.length > 0)

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-[min(420px,100vw)] flex-col gap-0 p-0 sm:max-w-none"
      >
        <SheetHeader className="border-line shrink-0 gap-1 border-b px-5 py-4 pr-14 text-left">
          <SheetTitle className="text-base">Valeurs de laboratoire</SheetTitle>
          <SheetDescription>
            {unitSystem === "si" ? "Unités SI canadiennes" : "Unités US"}
          </SheetDescription>
        </SheetHeader>

        <div className="border-line flex shrink-0 flex-col gap-3 border-b px-5 py-3">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder="Rechercher un paramètre"
          />
          <ToggleGroup
            type="single"
            variant="outline"
            value={unitSystem}
            onValueChange={(value) => {
              if (value) setUnitSystem(value as UnitSystem)
            }}
            aria-label="Système d'unités"
          >
            <ToggleGroupItem value="si" className="px-4 max-md:h-11">
              SI
            </ToggleGroupItem>
            <ToggleGroupItem value="us" className="px-4 max-md:h-11">
              US
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          {categories.length === 0 && (
            <p className="text-ink-3 py-6 text-sm">Aucune valeur trouvée.</p>
          )}
          {categories.map((category) => (
            <section key={category.id} aria-labelledby={`lab-${category.id}`}>
              <h3
                id={`lab-${category.id}`}
                className="text-ink-3 bg-surface sticky top-0 pt-4 pb-2 font-mono text-[11px] font-medium tracking-[0.06em] uppercase"
              >
                {category.name}
              </h3>
              <table className="w-full text-sm">
                <thead className="sr-only">
                  <tr>
                    <th>Paramètre</th>
                    <th>Valeur normale</th>
                    <th>Unité</th>
                  </tr>
                </thead>
                <tbody>
                  {category.values.map((value) => (
                    <tr key={value.id} className="border-line border-t">
                      <td className="text-ink py-2 pr-3">{value.name}</td>
                      <td className="text-ink py-2 pr-2 text-right font-mono whitespace-nowrap tabular-nums">
                        {unitSystem === "us" ? value.usValue : value.siValue}
                      </td>
                      <td className="text-ink-3 w-20 py-2 text-xs whitespace-nowrap">
                        {unitSystem === "us" ? value.usUnit : value.siUnit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
