"use client"

import { ArrowRight, Sparkles } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AboutCTA() {
  return (
    <div className="animate-fade-in-up">
      <div className="card-modern relative overflow-hidden p-12 text-center shadow-2xl">
        <div className="absolute inset-0 bg-linear-to-br from-blue-50 to-indigo-50 opacity-50 dark:from-blue-900/20 dark:to-indigo-900/20"></div>
        <div className="relative z-10 mx-auto max-w-3xl">
          <div className="mb-8 inline-flex items-center rounded-full border border-green-200/50 bg-linear-to-r from-green-100 to-emerald-100 px-6 py-3 text-sm font-semibold text-green-700 dark:border-green-700/50 dark:from-green-900/50 dark:to-emerald-900/50 dark:text-green-300">
            <Sparkles className="mr-2 h-4 w-4" />
            Prêt à commencer ?
          </div>
          <h2 className="font-display text-display-md mb-6 text-gray-900 dark:text-white">
            Rejoignez la communauté NOMAQbanq dès aujourd&apos;hui
          </h2>
          <p className="text-body-lg mb-10 leading-relaxed text-gray-600 dark:text-gray-300">
            Lancez votre préparation et accédez à des ressources de qualité pour
            réussir l&apos;EACMC.
          </p>
          <div className="flex flex-col justify-center gap-6 sm:flex-row">
            <Link href="/auth/sign-up">
              <Button
                className="btn-modern transform rounded-2xl bg-linear-to-r from-blue-600 to-indigo-600 px-12 py-4 text-lg font-semibold text-white shadow-xl transition-all duration-300 hover:scale-105 hover:from-blue-700 hover:to-indigo-700 hover:shadow-2xl"
                size={"lg"}
              >
                Commencer maintenant
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="mailto:nomaqbanq@outlook.com">
              <Button
                className="rounded-2xl border-2 border-blue-600 px-12 py-4 text-lg font-semibold text-blue-600 transition-all duration-300 hover:bg-blue-50 hover:shadow-lg dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20"
                size={"lg"}
                variant={"outline"}
              >
                Nous contacter
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
