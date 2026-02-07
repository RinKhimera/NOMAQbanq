"use client"

import Link from "next/link"
import { IconArrowLeft, IconHome, IconCompass } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        {/* Icon */}
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40">
          <IconCompass className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>

        {/* Title */}
        <h1 className="text-5xl font-bold text-emerald-600 dark:text-emerald-400">
          404
        </h1>
        <h2 className="mt-3 text-xl font-semibold text-gray-900 dark:text-white">
          Page introuvable
        </h2>

        {/* Message */}
        <p className="mt-3 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
          Cette page n&apos;existe pas ou a été déplacée. Pas d&apos;inquiétude,
          retournez à votre tableau de bord pour continuer.
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
            <Link href="/dashboard">
              <IconHome className="mr-2 h-4 w-4" />
              Mon tableau de bord
            </Link>
          </Button>
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => window.history.back()}
          >
            <IconArrowLeft className="mr-2 h-4 w-4" />
            Page précédente
          </Button>
        </div>
      </div>
    </div>
  )
}
