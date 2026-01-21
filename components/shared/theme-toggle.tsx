"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// useSyncExternalStore pour détecter le montage côté client sans setState dans useEffect
const emptySubscribe = () => () => {}

export default function ThemeToggle() {
  const { setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true, // Côté client : toujours monté
    () => false // Côté serveur : jamais monté
  )

  // Fermer le dropdown au scroll
  useEffect(() => {
    if (!open) return

    const handleScroll = () => setOpen(false)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [open])

  // Rendu d'un placeholder pendant le SSR pour éviter le mismatch d'hydratation
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl">
        <Sun className="h-5 w-5" />
        <span className="sr-only">Changer le thème</span>
      </Button>
    )
  }

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl">
          <Sun className="h-5 w-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-5 w-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Changer le thème</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="glass-card border border-gray-200 dark:border-gray-700"
      >
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="cursor-pointer"
        >
          <Sun className="mr-2 h-4 w-4" />
          <span>Clair</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="cursor-pointer"
        >
          <Moon className="mr-2 h-4 w-4" />
          <span>Sombre</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="cursor-pointer"
        >
          <Monitor className="mr-2 h-4 w-4" />
          <span>Système</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
