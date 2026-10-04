"use client"

import { LayoutDashboard, LogOut, Menu } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Logo } from "@/components/shared/logo"
import ThemeToggle from "@/components/shared/theme-toggle"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetTrigger } from "@/components/ui/sheet"
import { HEADER_NAV } from "@/constants"
import { useMounted } from "@/hooks/use-mounted"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { MobileMenu } from "./mobile-menu"
import { navCurrent } from "./nav-current"

export const MarketingHeader = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const { currentUser, isAuthenticated } = useCurrentUser()
  // La session n'est pas résolue au SSR : la laisser choisir le balisage
  // pendant l'hydratation produit deux arbres DOM différents.
  const showUser = useMounted() && isAuthenticated
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push("/connexion")
  }

  useEffect(() => {
    if (!isUserMenuOpen) return

    const handleScroll = () => setIsUserMenuOpen(false)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [isUserMenuOpen])

  return (
    // Le Sheet enveloppe l'en-tête pour que le bouton du menu soit un
    // `SheetTrigger` : Radix lui rend le focus à la fermeture.
    <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
      <header className="bg-background border-line sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6 lg:gap-8">
          <Link
            href="/"
            className="focus-ring flex items-center rounded-md max-md:min-h-11"
          >
            <Logo />
          </Link>

          <nav
            aria-label="Navigation principale"
            className="mr-auto hidden items-center gap-6 lg:flex"
          >
            {HEADER_NAV.map((item) => {
              const current = navCurrent(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current}
                  className={cn(
                    "focus-ring rounded-md text-sm",
                    current
                      ? "text-ink font-medium"
                      : "text-ink-2 hover:text-ink",
                  )}
                >
                  {item.name}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:gap-4">
            <span className="max-[480px]:hidden">
              <ThemeToggle />
            </span>

            {showUser && currentUser ? (
              <DropdownMenu
                modal={false}
                open={isUserMenuOpen}
                onOpenChange={setIsUserMenuOpen}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full max-md:size-11"
                    aria-label="Menu du compte"
                  >
                    <UserAvatar
                      name={currentUser.name}
                      image={currentUser.image}
                      className="size-8"
                      fallbackClassName="bg-surface-2 text-ink-2 text-xs font-medium"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <div className="px-2 py-2">
                    <p className="text-ink truncate text-sm font-medium">
                      {currentUser.name}
                    </p>
                    <p className="text-ink-3 truncate text-xs">
                      {currentUser.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="max-md:min-h-11">
                    <Link href="/tableau-de-bord">
                      <LayoutDashboard aria-hidden />
                      <span>Tableau de bord</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="max-md:min-h-11"
                    variant="destructive"
                    onClick={handleSignOut}
                  >
                    <LogOut aria-hidden />
                    <span>Se déconnecter</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <span className="hidden items-center gap-4 lg:flex">
                  <Link
                    href="/connexion"
                    className="focus-ring text-ink-2 hover:text-ink rounded-md text-sm transition-[background-color,border-color] duration-(--duration-base)"
                  >
                    Connexion
                  </Link>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/evaluation">Essai gratuit</Link>
                  </Button>
                </span>
                <Button asChild size="sm" className="max-md:h-11">
                  <Link href="/inscription">S&apos;inscrire</Link>
                </Button>
              </>
            )}

            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-mr-2 max-md:size-11 lg:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
          </div>
        </div>

        <MobileMenu
          onClose={() => setIsMobileMenuOpen(false)}
          currentUser={currentUser}
          isAuthenticated={showUser}
          onSignOut={handleSignOut}
        />
      </header>
    </Sheet>
  )
}
