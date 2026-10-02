"use client"

import { Minus, Plus } from "lucide-react"
import { useState } from "react"
import { countLabel } from "@/components/admin/question-detail/labels"
import { RECENT_EXAMS_DEFAULT } from "@/features/questions/recent-exams"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { TOUCH_TARGET } from "@/lib/touch-target"
import { cn } from "@/lib/utils"

export const notUsedSinceLabel = (n: number) =>
  `Pas utilisée depuis ${countLabel(n, "examen")}`

/**
 * Filtre « Dernière utilisation » : « Toutes » ou « Pas utilisée depuis [n]
 * examens », n de 1 à `max`. Liste des questions et banque du compositeur
 * d'examen (`layout="row"`).
 */
export const NotUsedSinceField = ({
  value,
  onChange,
  max,
  name = "not-used-since",
  layout = "column",
}: {
  value: number | null
  onChange: (value: number | null) => void
  max: number
  /** Nom du groupe de boutons radio, unique dans la page. */
  name?: string
  layout?: "column" | "row"
}) => {
  const [count, setCount] = useState(value ?? RECENT_EXAMS_DEFAULT)
  // Le nombre ne recharge la liste qu'une fois la saisie posée : chaque
  // rechargement recalcule l'agrégat de la banque.
  useDebouncedValue(count, 400, (n) => {
    if (value !== null && n !== value) onChange(n)
  })
  const setN = (n: number) => setCount(Math.max(1, Math.min(max, n)))
  return (
    <div
      className={cn(
        "flex gap-2 text-sm",
        layout === "row" ? "flex-row flex-wrap gap-x-4 gap-y-1" : "flex-col",
      )}
    >
      <label className="flex min-h-8 cursor-pointer items-center gap-2">
        <input
          type="radio"
          name={name}
          checked={value === null}
          onChange={() => onChange(null)}
          className="size-4 accent-(--accent)"
        />
        Toutes
      </label>
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name={name}
            checked={value !== null}
            onChange={() => onChange(count)}
            aria-label={notUsedSinceLabel(count)}
            className="size-4 accent-(--accent)"
          />
          Pas utilisée depuis
        </label>
        <span
          role="group"
          aria-label="Nombre d'examens"
          className="border-line-strong inline-flex h-8 items-center rounded-md border"
        >
          <button
            type="button"
            aria-label="Moins"
            disabled={count <= 1}
            onClick={() => setN(count - 1)}
            className={cn(
              TOUCH_TARGET,
              "focus-ring text-ink-2 hover:bg-surface-2 flex size-8 cursor-pointer items-center justify-center rounded-l-md disabled:cursor-default disabled:opacity-40",
            )}
          >
            <Minus aria-hidden className="size-3" />
          </button>
          <input
            inputMode="numeric"
            aria-label="Nombre d'examens"
            value={count}
            onFocus={() => value === null && onChange(count)}
            onChange={(e) =>
              setN(Number(e.target.value.replace(/\D/g, "")) || 1)
            }
            className="w-8 bg-transparent text-center font-mono text-sm outline-none"
          />
          <button
            type="button"
            aria-label="Plus"
            disabled={count >= max}
            onClick={() => setN(count + 1)}
            className={cn(
              TOUCH_TARGET,
              "focus-ring text-ink-2 hover:bg-surface-2 flex size-8 cursor-pointer items-center justify-center rounded-r-md disabled:cursor-default disabled:opacity-40",
            )}
          >
            <Plus aria-hidden className="size-3" />
          </button>
        </span>
        <span aria-hidden>{count > 1 ? "examens" : "examen"}</span>
      </div>
    </div>
  )
}
