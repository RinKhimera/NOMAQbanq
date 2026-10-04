"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMounted } from "@/hooks/use-mounted"

// 32 px dans une barre à partir de 1024 px ; cibles tactiles de 44 px sous
// 768 px, déclencheur et entrées du menu.
const TRIGGER_SIZE = "size-11 md:size-10 lg:size-8"
const ITEM_SIZE = "max-md:min-h-11"

/** Icône selon la classe `.dark` : ni thème ni montage lus au rendu. */
const ThemeIcon = () => (
  <>
    <Sun aria-hidden className="dark:hidden" />
    <Moon aria-hidden className="hidden dark:block" />
  </>
)

export default function ThemeToggle() {
  const { setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const mounted = useMounted()

  useEffect(() => {
    if (!open) return

    const handleScroll = () => setOpen(false)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [open])

  // Rendu d'un placeholder pendant le SSR pour éviter le mismatch d'hydratation
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={TRIGGER_SIZE}>
        <ThemeIcon />
        <span className="sr-only">Changer le thème</span>
      </Button>
    )
  }

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={TRIGGER_SIZE}>
          <ThemeIcon />
          <span className="sr-only">Changer le thème</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className={ITEM_SIZE}
          onClick={() => setTheme("light")}
        >
          <Sun aria-hidden />
          <span>Clair</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className={ITEM_SIZE}
          onClick={() => setTheme("dark")}
        >
          <Moon aria-hidden />
          <span>Sombre</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className={ITEM_SIZE}
          onClick={() => setTheme("system")}
        >
          <Monitor aria-hidden />
          <span>Système</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
