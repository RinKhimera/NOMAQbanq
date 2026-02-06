"use client"

import { ArrowLeft, Home, UserX } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="mx-auto max-w-md text-center">
          {/* Logo/Icon Section */}
          <div className="mb-8">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30">
              <UserX className="h-12 w-12 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          {/* Error Code */}
          <div className="mb-6">
            <h1 className="bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-6xl font-bold text-transparent dark:from-blue-400 dark:to-indigo-400">
              404
            </h1>
            <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-linear-to-r from-blue-500 to-indigo-500"></div>
          </div>

          {/* Message */}
          <div className="mb-8 space-y-3">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Page introuvable
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Désolé, nous n&apos;avons pas pu trouver la page que vous
              recherchez. Elle a peut-être été déplacée ou supprimée.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              asChild
              className="bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
            >
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Retour à l&apos;accueil
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="cursor-pointer border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
              onClick={() => window.history.back()}
            >
              <div>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Page précédente
              </div>
            </Button>
          </div>

          {/* Additional Help */}
          <div className="mt-12 text-sm text-gray-500 dark:text-gray-400">
            <p>
              Besoin d&apos;aide ?{" "}
              <Link
                href="mailto:dixiades@gmail.com"
                className="text-blue-600 underline transition-colors duration-200 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Contactez notre équipe de support.
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
