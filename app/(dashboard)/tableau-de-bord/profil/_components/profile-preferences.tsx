"use client"

import { useTheme } from "next-themes"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
  { value: "system", label: "Auto" },
] as const

/** Thème de l'interface : Clair, Sombre ou Auto (celui du système). */
export const ProfilePreferences = () => {
  const { theme, setTheme } = useTheme()
  // Le thème ne se lit qu'au navigateur : « Auto » au rendu serveur, pour un
  // premier rendu identique des deux côtés.
  const mounted = useMounted()
  const current = mounted ? (theme ?? "system") : "system"

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-ink text-[0.9375rem]">
          Thème de l&apos;interface
        </span>
        <span className="text-ink-3 text-[0.8125rem]">
          Choisissez l&apos;apparence de l&apos;application.
        </span>
      </div>
      <div
        role="group"
        aria-label="Thème de l'interface"
        className="border-line-strong inline-flex overflow-hidden rounded-md border"
      >
        {THEMES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={current === option.value}
            data-testid={`theme-${option.value}`}
            onClick={() => setTheme(option.value)}
            className={cn(
              "focus-ring border-line-strong text-ink-2 hover:bg-surface-2 aria-pressed:bg-accent-soft aria-pressed:text-accent-ink h-8 border-l px-3 text-sm font-medium transition-[background-color] first:border-l-0 max-md:h-11 max-md:px-4",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
