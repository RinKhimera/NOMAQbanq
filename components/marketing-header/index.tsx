"use client"

import { SignOutButton } from "@clerk/clerk-react"
import { LayoutDashboard, LogOut, Menu, User } from "lucide-react"
import { motion } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import ThemeToggle from "@/components/shared/theme-toggle"
import { MobileMenu } from "./mobile-menu"
import { useHeaderScroll } from "./use-header-scroll"

const navigation = [
  { name: "Accueil", href: "/" },
  { name: "Domaines", href: "/domaines" },
  { name: "Tarifs", href: "/tarifs" },
  { name: "FAQ", href: "/faq" },
  { name: "À propos", href: "/a-propos" },
]

export const MarketingHeader = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const { isVisible, isScrolled } = useHeaderScroll()
  const { currentUser, isAuthenticated } = useCurrentUser()
  const pathname = usePathname()

  // Fermer le dropdown utilisateur au scroll
  useEffect(() => {
    if (!isUserMenuOpen) return

    const handleScroll = () => setIsUserMenuOpen(false)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [isUserMenuOpen])

  return (
    <>
      <motion.header
        initial={{ y: 0 }}
        animate={{
          y: isVisible ? 0 : -100,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
        className={`fixed top-0 z-50 w-full border-b transition-all duration-300 ${
          isScrolled
            ? "h-16 border-gray-200/60 bg-white/95 shadow-sm backdrop-blur-xl dark:border-gray-800/60 dark:bg-gray-950/95"
            : "h-[72px] border-gray-200/40 bg-white/90 backdrop-blur-md dark:border-gray-800/40 dark:bg-gray-950/90"
        }`}
      >
        <div className="mx-auto h-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-full items-center justify-between">
            {/* Logo */}
            <Link
              href="/"
              className="group flex items-center gap-2.5 transition-all duration-300"
            >
              <div
                className={`relative transition-all duration-300 ${
                  isScrolled ? "size-10" : "size-12"
                }`}
              >
                <Image
                  src="/noma-logo.svg"
                  alt="Logo NOMAQbanq"
                  fill
                  sizes="48px"
                  priority
                  className="object-contain transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-col">
                <span
                  className={`font-display font-extrabold tracking-tight transition-all duration-300 ${
                    isScrolled ? "text-lg" : "text-xl"
                  }`}
                >
                  <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
                    NOMAQ
                  </span>
                  <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-blue-400">
                    banq
                  </span>
                </span>
                <span
                  className={`font-medium tracking-widest text-gray-500 transition-all duration-300 dark:text-gray-400 ${
                    isScrolled
                      ? "h-0 overflow-hidden opacity-0"
                      : "text-[0.5rem] opacity-100"
                  }`}
                >
                  EXCELLENCE MÉDICALE
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden items-center gap-8 lg:flex">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group relative px-1 py-2 text-[15px] font-medium transition-colors duration-200 ${
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                    }`}
                  >
                    {item.name}
                    <span
                      className={`absolute -bottom-0.5 left-0 h-0.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 ${
                        isActive ? "w-full" : "w-0 group-hover:w-full"
                      }`}
                    />
                  </Link>
                )
              })}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden items-center gap-3 lg:flex">
              <ThemeToggle />

              {isAuthenticated && currentUser ? (
                <DropdownMenu
                  modal={false}
                  open={isUserMenuOpen}
                  onOpenChange={setIsUserMenuOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative size-10 rounded-full ring-2 ring-transparent transition-all duration-300 hover:ring-blue-500/30"
                    >
                      <Avatar className="size-10 transition-transform duration-300 hover:scale-105">
                        <AvatarImage
                          src={currentUser.image}
                          alt={currentUser.name}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                          {currentUser.name?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-white bg-green-500 dark:border-gray-950" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-60 border border-gray-200 bg-white/95 backdrop-blur-xl dark:border-gray-700 dark:bg-gray-950/95"
                  >
                    <div className="px-3 py-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {currentUser.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {currentUser.email}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link
                        href="/dashboard"
                        className="flex items-center gap-2"
                      >
                        <LayoutDashboard className="size-4" />
                        <span>Dashboard</span>
                        <Badge className="ml-auto bg-blue-600 text-xs">
                          Nouveau
                        </Badge>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer">
                      <User className="mr-2 size-4" />
                      <span>Profil</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <SignOutButton>
                      <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600">
                        <LogOut className="mr-2 size-4" />
                        <span>Déconnexion</span>
                      </DropdownMenuItem>
                    </SignOutButton>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Link href="/auth/sign-in">
                    <Button
                      variant="ghost"
                      className="rounded-xl px-5 py-2 text-[15px] font-medium text-gray-600 transition-all duration-200 hover:bg-gray-100 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-blue-400"
                    >
                      Connexion
                    </Button>
                  </Link>
                  <Link href="/auth/sign-up">
                    <Button className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2 text-[15px] font-semibold text-white shadow-md transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg">
                      Inscription
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Trigger */}
            <div className="flex items-center gap-2 lg:hidden">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-xl"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu className="size-5" />
                <span className="sr-only">Ouvrir le menu</span>
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onOpenChange={setIsMobileMenuOpen}
        navigation={navigation}
        currentUser={currentUser}
        isAuthenticated={isAuthenticated}
      />

      {/* Spacer pour le contenu */}
      <div className={isScrolled ? "h-16" : "h-[72px]"} />
    </>
  )
}

export default MarketingHeader
