"use client"

import { useTheme } from "next-themes"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useMounted } from "@/hooks/use-mounted"

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
  const current = (mounted ? theme : undefined) ?? "system"

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
      <SegmentedControl
        label="Thème de l'interface"
        value={current}
        options={THEMES}
        onValueChange={setTheme}
        testIdPrefix="theme"
      />
    </div>
  )
}
