"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function DomainesCTA() {
  return (
    <div className="animate-fade-in-up">
      <div className="card-modern p-12 text-center shadow-xl">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display mb-6 text-3xl font-bold text-gray-900 dark:text-white">
            Prêt à commencer votre évaluation ?
          </h2>
          <p className="text-body-lg mb-10 leading-relaxed text-gray-600 dark:text-gray-300">
            Choisissez un domaine ci-dessus ou commencez par une évaluation
            générale pour tester vos connaissances globales
          </p>
          <div className="flex flex-col justify-center gap-6 sm:flex-row">
            <Link href="/evaluation">
              <Button className="btn-modern cursor-pointer rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-10 py-4 font-semibold text-white transition-all duration-300 hover:scale-105 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl">
                Évaluation générale
              </Button>
            </Link>
            <Button
              variant="outline"
              className="rounded-2xl border-2 border-blue-600 px-10 py-4 font-semibold text-blue-600 transition-all duration-300 hover:bg-blue-50 hover:shadow-lg dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              Voir mon progrès
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
