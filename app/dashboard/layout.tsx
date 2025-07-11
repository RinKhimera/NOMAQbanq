"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  BarChart3,
  Award,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";


const CloseIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 1024 1024"
    fill="currentColor"
    width={props.width || 24}
    height={props.height || 24}
    {...props}
  >
    <path d="M195.2 195.2a64 64 0 0 1 90.496 0L512 421.504 738.304 195.2a64 64 0 0 1 90.496 90.496L602.496 512 828.8 738.304a64 64 0 0 1-90.496 90.496L512 602.496 285.696 828.8a64 64 0 0 1-90.496-90.496L421.504 512 195.2 285.696a64 64 0 0 1 0-90.496z" />
  </svg>
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/connexion");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const navigation = [
    {
      name: "Tableau de bord",
      href: "/dashboard",
      icon: LayoutDashboard,
      description: "Vue d'ensemble",
    },
    {
      name: "Évaluations",
      href: "/evaluation",
      icon: BookOpen,
      description: "Nouveau quiz",
    },
    {
      name: "Mes résultats",
      href: "/dashboard/results",
      icon: BarChart3,
      description: "Historique",
    },
    {
      name: "Mon profil",
      href: "/dashboard/profile",
      icon: User,
      description: "Informations",
    },
    {
      name: "Paramètres",
      href: "/dashboard/settings",
      icon: Settings,
      description: "Préférences",
    },
  ];

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  // Largeur de la sidebar : 72 (18rem) étendue, 24 (6rem) réduite
  const sidebarWidth = sidebarCollapsed ? "w-30" : "w-72";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <div
          className={`
            fixed lg:relative top-24 bottom-0 left-0 z-40 ${sidebarWidth} bg-white dark:bg-gray-800 shadow-xl transform transition-all duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between h-24 px-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-indigo-600">
            {!sidebarCollapsed && (
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">N</span>
                </div>
                <div>
                  <span className="text-lg font-bold text-white">NOMAQbank</span>
                  <p className="text-base text-blue-100">Espace personnel</p>
                </div>
              </div>
            )}
            <div className="flex items-center space-x-2">
              {/* Collapse Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="h-12 w-12 p-0 text-white/80 hover:text-white hover:bg-white/20"
              >
                {sidebarCollapsed ? (
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105">
                    <span className="text-white font-bold text-xl transform hover:rotate-12 transition-transform">N</span>
                  </div>
                ) : (
                  <CloseIcon className="h-7 w-7" />
                )}
              </Button>
              {/* Mobile Close Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-white hover:bg-white/20 h-12 w-12"
              >
                <X className="h-7 w-7" />
              </Button>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 px-3 py-6">
            <div className="space-y-3">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                    group flex items-center px-5 py-4 rounded-xl transition-all duration-200 hover:shadow-md
                    ${
                      isActive
                        ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md"
                        : "text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400"
                    }
                  `}
                    onClick={() => setSidebarOpen(false)}
                    title={sidebarCollapsed ? item.name : undefined}
                  >
                    <div
                      className={`
                    w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200
                    ${
                      isActive
                        ? "bg-white/20 backdrop-blur-sm"
                        : "group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30"
                    }
                  `}
                    >
                      <item.icon
                        className={`h-6 w-6 transition-all duration-200 ${
                          isActive
                            ? "text-white"
                            : "text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        }`}
                      />
                    </div>
                    {!sidebarCollapsed && (
                      <div className="ml-5 flex-1 min-w-0">
                        <p
                          className={`text-lg font-semibold transition-colors duration-200 ${
                            isActive
                              ? "text-white"
                              : "group-hover:text-blue-600 dark:group-hover:text-blue-400"
                          }`}
                        >
                          {item.name}
                        </p>
                        <p
                          className={`text-base mt-1 transition-colors duration-200 ${
                            isActive
                              ? "text-blue-100"
                              : "text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-300"
                          }`}
                        >
                          {item.description}
                        </p>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Quick Stats */}
          {!sidebarCollapsed && (
            <div className="px-4 py-5 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Statistiques rapides
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                      Score
                    </span>
                  </div>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-300 mt-1">
                    {user.stats?.averageScore || 0}%
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                      Questions
                    </span>
                  </div>
                  <p className="text-lg font-bold text-green-700 dark:text-green-300 mt-1">
                    {user.stats?.questionsAnswered || 0}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* User Profile Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-5">
            {!sidebarCollapsed ? (
              <div className="space-y-5">
                <div className="flex items-center space-x-5">
                  <Image
                    src={
                      user.avatar ||
                      "https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=60"
                    }
                    alt={user.name}
                    width={70}
                    height={70}
                    className="w-14 h-14 rounded-xl object-cover shadow-md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {user.name}
                    </p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span
                        className={`px-4 py-1 rounded-full text-base font-medium ${
                          user.subscription?.type === "premium"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        }`}
                      >
                        {user.subscription?.type === "premium"
                          ? "Premium"
                          : "Gratuit"}
                      </span>
                      {user.subscription?.type === "premium" && (
                        <Award className="h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="lg"
                  className="w-full text-red-600 dark:text-red-400 border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 h-12 text-base"
                >
                  <LogOut className="h-6 w-6 mr-3" />
                  Déconnexion
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <Image
                  src={
                    user.avatar ||
                    "https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=60"
                  }
                  alt={user.name}
                  width={70}
                  height={70}
                  className="w-12 h-12 rounded-xl object-cover shadow-md"
                  title={user.name}
                />
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center"
                  title="Déconnexion"
                >
                  <LogOut className="h-6 w-6" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Bouton menu mobile */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-50 lg:hidden bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg"
        >
          <Menu className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>

        {/* Page Content */}
        <main className="flex-1 p-6 bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}
