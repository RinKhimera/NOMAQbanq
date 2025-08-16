"use client"

import { Heart, Star } from "lucide-react"

export default function AboutStory() {
  return (
    <div className="mb-20">
      <div className="animate-slide-in-left">
        <div className="mb-8 inline-flex items-center rounded-full border border-green-200/50 bg-gradient-to-r from-green-100 to-emerald-100 px-6 py-3 text-sm font-semibold text-green-700 dark:border-green-700/50 dark:from-green-900/50 dark:to-emerald-900/50 dark:text-green-300">
          <Heart className="mr-2 h-4 w-4" />
          Notre histoire
        </div>
        <h2 className="font-display text-display-md mb-8 text-gray-900 dark:text-white">
          D&apos;une initiative à une communauté
        </h2>
        <div className="text-body space-y-6 leading-relaxed text-gray-700 dark:text-gray-300">
          <p>
            NOMAQbank est née d&apos;un constat simple : les candidats
            francophones à l&apos;EACMC manquaient de ressources adaptées à leur
            langue et à leur contexte culturel.
          </p>
          <p>
            Fondée par des professionnels de santé francophones ayant réussi
            l&apos;examen, notre plateforme combine expertise médicale et
            compréhension des défis spécifiques auxquels font face les candidats
            francophones.
          </p>
          <p>
            Aujourd&apos;hui, nous accompagnons des milliers de candidats vers
            la réussite, avec un taux de succès de 85% parmi nos utilisateurs
            actifs.
          </p>
        </div>

        <div className="mt-8 flex items-center space-x-4">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-12 w-12 rounded-full border-2 border-white bg-gradient-to-br from-blue-400 to-indigo-600 shadow-lg dark:border-gray-800"
              ></div>
            ))}
          </div>
          <div>
            <div className="mb-1 flex items-center space-x-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="h-4 w-4 fill-current text-yellow-400"
                />
              ))}
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Plus de 4000 candidats nous font confiance
            </p>
          </div>
        </div>
      </div>

      {/* Right visual is handled in original page; keep layout-only here */}
    </div>
  )
}
