"use client"

import { SignOutButton } from "@clerk/clerk-react"
import {
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Sun,
  User,
  X,
} from "lucide-react"
import { useTheme } from "next-themes"
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
import ThemeToggle from "./shared/theme-toggle"

export default function NavBar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const { setTheme } = useTheme()
  const { currentUser, isAuthenticated } = useCurrentUser()
  const pathname = usePathname()

  const navigation = [
    { name: "Accueil", href: "/" },
    { name: "Domaines", href: "/domaines" },
    { name: "À propos", href: "/a-propos" },
  ]

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav
      className={`glass-card fixed top-0 z-50 w-full border-b transition-all duration-300 ${
        isScrolled
          ? "h-16 border-white/30 bg-white/95 shadow-xl backdrop-blur-xl dark:border-gray-800/50 dark:bg-gray-900/95"
          : "h-20 border-white/20 bg-white/80 shadow-lg backdrop-blur-md dark:border-gray-800/50 dark:bg-gray-900/80"
      }`}
    >
      <div className="mx-auto h-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-full items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center space-x-2 transition-all duration-300"
          >
            <div
              className={`relative transition-all duration-300 ${
                isScrolled ? "size-12" : "size-16"
              }`}
            >
              <Image
                src="/noma-logo.svg"
                alt="Logo NOMAQbanq"
                fill
                sizes="60px"
                priority
                className="object-contain p-1 transition-transform duration-300 group-hover:scale-110"
              />
            </div>
            <div className="flex flex-col">
              <span
                className={`font-display font-extrabold tracking-tight transition-all duration-300 ${
                  isScrolled ? "text-xl" : "text-2xl"
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
                  isScrolled ? "text-[0.5rem]" : "text-[0.55rem]"
                }`}
              >
                EXCELLENCE MÉDICALE
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center space-x-8 md:flex">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group relative text-lg font-medium transition-all duration-300 ${
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                  }`}
                >
                  {item.name}
                  <span
                    className={`absolute -bottom-1 left-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 ${
                      isActive ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  ></span>
                </Link>
              )
            })}

            <div className="flex items-center space-x-3">
              {/* Theme Toggle */}
              <ThemeToggle />

              {isAuthenticated && currentUser ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 w-10 rounded-full ring-2 ring-transparent transition-all duration-300 hover:ring-blue-500/50"
                    >
                      <Avatar className="h-10 w-10 transition-transform duration-300 hover:scale-110">
                        <AvatarImage
                          src={currentUser.image}
                          alt={currentUser.name}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                          {currentUser.name?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      {/* Online indicator */}
                      <span className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-gray-900"></span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="glass-card w-64 border border-gray-200 dark:border-gray-700"
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
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Dashboard</span>
                        <Badge className="ml-auto bg-blue-500 text-xs">
                          Nouveau
                        </Badge>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profil</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <SignOutButton>
                      <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600">
                        <LogOut className="mr-2 h-4 w-4" />
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
                      className="rounded-xl px-6 py-2 font-medium text-gray-700 transition-all duration-300 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                    >
                      Connexion
                    </Button>
                  </Link>
                  <Link href="/auth/sign-up">
                    <Button className="btn-modern group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-2 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl">
                      <span className="relative z-10">Inscription</span>
                      <span className="absolute inset-0 -z-10 bg-gradient-to-r from-indigo-600 to-blue-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></span>
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center space-x-2 md:hidden">
            {/* Mobile Theme Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl transition-all duration-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <Sun className="h-5 w-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
                  <Moon className="absolute h-5 w-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
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

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-xl p-2.5 text-gray-700 transition-all duration-300 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
              aria-label="Menu"
            >
              {isOpen ? (
                <X className="h-6 w-6 transition-transform duration-300" />
              ) : (
                <Menu className="h-6 w-6 transition-transform duration-300" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div
          className={`overflow-hidden transition-all duration-300 md:hidden ${
            isOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="glass-card mb-4 space-y-2 rounded-2xl border-t border-white/20 bg-white/90 px-2 pt-2 pb-6 shadow-xl backdrop-blur-xl dark:border-gray-800/50 dark:bg-gray-900/90">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`block rounded-xl px-4 py-3 text-lg font-medium transition-all duration-300 ${
                    isActive
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                      : "text-gray-700 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  <span className="flex items-center gap-2">
                    {item.name}
                    {isActive && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400"></span>
                    )}
                  </span>
                </Link>
              )
            })}
            <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
              {isAuthenticated && currentUser ? (
                <>
                  <div className="flex items-center space-x-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 dark:from-blue-900/20 dark:to-indigo-900/20">
                    <Avatar className="h-12 w-12 ring-2 ring-white dark:ring-gray-800">
                      <AvatarImage
                        src={currentUser.image}
                        alt={currentUser.name}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                        {currentUser.name?.charAt(0)?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {currentUser.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {currentUser.email}
                      </p>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  </div>
                  <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start rounded-xl font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                    >
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                      <Badge className="ml-auto bg-blue-500 text-xs">
                        Nouveau
                      </Badge>
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    className="w-full justify-start rounded-xl font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Profil
                  </Button>
                  <SignOutButton>
                    <Button
                      variant="ghost"
                      className="w-full justify-start rounded-xl font-medium text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Déconnexion
                    </Button>
                  </SignOutButton>
                </>
              ) : (
                <>
                  <Link href="/auth/sign-in" onClick={() => setIsOpen(false)}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start rounded-xl font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                    >
                      Connexion
                    </Button>
                  </Link>
                  <Link href="/auth/sign-up" onClick={() => setIsOpen(false)}>
                    <Button className="btn-modern w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg hover:from-blue-700 hover:to-indigo-700">
                      Inscription
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
