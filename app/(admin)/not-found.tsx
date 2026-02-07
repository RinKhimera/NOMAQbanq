"use client"

import Link from "next/link"
import { IconArrowLeft, IconLayoutDashboard, IconAlertTriangle } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Geometric accent block */}
        <div className="mb-8 flex items-start gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/40">
            <IconAlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium tracking-widest text-amber-600 uppercase dark:text-amber-400">
              Erreur 404
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              Page admin introuvable
            </h1>
          </div>
        </div>

        {/* Separator */}
        <div className="mb-6 h-px bg-gray-200 dark:bg-gray-800" />

        {/* Message */}
        <p className="mb-8 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
          Cette page d&apos;administration n&apos;existe pas ou a été déplacée.
          Vérifiez l&apos;URL ou retournez au tableau de bord.
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <Button asChild size="sm">
            <Link href="/admin">
              <IconLayoutDashboard className="mr-2 h-4 w-4" />
              Tableau de bord
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500"
            onClick={() => window.history.back()}
          >
            <IconArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </div>
      </div>
    </div>
  )
}
