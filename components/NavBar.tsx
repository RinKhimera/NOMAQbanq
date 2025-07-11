"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import {
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
  User,
  LogOut,
  Settings,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import LanguageSelector from "@/components/LanguageSelector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function NavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const { setTheme } = useTheme();
  const { t } = useLanguage();
  const { user, logout } = useAuth();

  const navigation = [
    { name: t("nav.home"), href: "/" },
    { name: t("nav.domains"), href: "/domaines" },
    { name: t("nav.about"), href: "/a-propos" },
  ];

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 w-full glass-card border-b border-white/20 dark:border-gray-800/50 z-50 shadow-lg bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg">
      <div className="max-w-[90rem] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 2xl:px-10">
        <div className="flex justify-between items-center h-14 sm:h-16 md:h-18 lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group shrink-0">
            <div className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 rounded-lg sm:rounded-xl lg:rounded-2xl overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-105">
              <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs sm:text-sm md:text-base lg:text-lg">N</span>
              </div>
            </div>
            <span className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white font-display tracking-tight">
              NOMAQbank
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center md:space-x-2 lg:space-x-4 xl:space-x-6">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300 font-medium text-sm lg:text-base xl:text-lg whitespace-nowrap relative group px-2 py-1"
              >
                {item.name}
                <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:w-full transition-all duration-300"></span>
              </Link>
            ))}

            <div className="flex items-center space-x-3">
              {/* Language Selector */}
              <LanguageSelector />

              {/* Theme Toggle */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 rounded-xl"
                  >
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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
                    <span>{t("nav.theme.light")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme("dark")}
                    className="cursor-pointer"
                  >
                    <Moon className="mr-2 h-4 w-4" />
                    <span>{t("nav.theme.dark")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme("system")}
                    className="cursor-pointer"
                  >
                    <Monitor className="mr-2 h-4 w-4" />
                    <span>{t("nav.theme.system")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User Menu or Auth Buttons */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center space-x-3 px-4 py-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300"
                    >
                      <Image
                        src={
                          user.avatar ||
                          "https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=60"
                        }
                        alt={user.name}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full object-cover"
                        priority
                        unoptimized={!!user.avatar}
                      />
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {user.name.split(" ")[0]}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="glass-card border border-gray-200 dark:border-gray-700 w-56"
                  >
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {user.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {user.email}
                      </p>
                    </div>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/dashboard" className="flex items-center">
                        <BarChart3 className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link
                        href="/dashboard/profile"
                        className="flex items-center"
                      >
                        <User className="mr-2 h-4 w-4" />
                        <span>Profil</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link
                        href="/dashboard/settings"
                        className="flex items-center"
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Paramètres</span>
                      </Link>
                    </DropdownMenuItem>
                    {user.role === "admin" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link
                            href="/admin"
                            className="flex items-center text-blue-600 dark:text-blue-400"
                          >
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Administration</span>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="cursor-pointer text-red-600 dark:text-red-400"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Se déconnecter</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Link href="/connexion">
                    <Button
                      variant="ghost"
                      className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-6 py-2 rounded-xl font-medium transition-all duration-300"
                    >
                      {t("nav.login")}
                    </Button>
                  </Link>
                  <Link href="/inscription">
                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-2 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 btn-modern">
                      {t("nav.signup")}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-1 sm:space-x-2">
            <LanguageSelector />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl"
                >
                  <Sun className="h-4 w-4 sm:h-5 sm:w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 sm:h-5 sm:w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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
                  <span>{t("nav.theme.light")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("dark")}
                  className="cursor-pointer"
                >
                  <Moon className="mr-2 h-4 w-4" />
                  <span>{t("nav.theme.dark")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("system")}
                  className="cursor-pointer"
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  <span>{t("nav.theme.system")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-3 rounded-xl text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300"
            >
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden fixed inset-x-0 top-[56px] sm:top-[64px] max-h-[calc(100vh-56px)] sm:max-h-[calc(100vh-64px)] overflow-y-auto bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg">
            <div className="mx-3 sm:mx-4 my-2 px-2 py-3 space-y-1.5 glass-card border border-white/20 dark:border-gray-800/50 rounded-xl shadow-lg">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block px-3 py-2 text-[15px] font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-300"
                  onClick={() => setIsOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                {user ? (
                  <>
                    <div className="px-3 py-2">
                      <p className="font-semibold text-gray-900 dark:text-white text-[15px]">
                        {user.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                        {user.email}
                      </p>
                    </div>
                    <Link href="/dashboard" className="block">
                      <Button
                        variant="ghost"
                        className="w-full justify-start px-3 py-2 h-auto text-[15px] text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg font-medium"
                      >
                        Dashboard
                      </Button>
                    </Link>
                    <Button
                      onClick={handleLogout}
                      variant="ghost"
                      className="w-full justify-start px-3 py-2 h-auto text-[15px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium"
                    >
                      Se déconnecter
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/connexion" className="block">
                      <Button
                        variant="ghost"
                        className="w-full justify-start px-3 py-2 h-auto text-[15px] text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg font-medium"
                      >
                        {t("nav.login")}
                      </Button>
                    </Link>
                    <Link href="/inscription" className="block">
                      <Button className="w-full px-3 py-2 h-auto text-[15px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold shadow-md hover:shadow-lg btn-modern">
                        {t("nav.signup")}
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
